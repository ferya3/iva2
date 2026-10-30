import type { VisualPort, VisualStimulusSpec } from '@cognitest/assessment-engine';

export interface DomRendererOptions {
  /** Element that hosts the stimulus layer; usually a full-screen div. */
  container: HTMLElement;
  background?: string;
}

/**
 * Pre-builds one absolutely-positioned node per stimulus and toggles
 * visibility only. Showing a stimulus is therefore a single style write with
 * no layout of new content, which keeps the frame callback well under 1 ms
 * and makes the change land on the very next vsync.
 */
export class DomStimulusRenderer implements VisualPort {
  private readonly layer: HTMLElement;
  private readonly nodes = new Map<string, HTMLElement>();
  private visible: HTMLElement | null = null;

  constructor(private readonly options: DomRendererOptions) {
    const doc = options.container.ownerDocument;
    this.layer = doc.createElement('div');
    this.layer.setAttribute('data-stimulus-layer', '');
    Object.assign(this.layer.style, {
      position: 'absolute',
      inset: '0',
      background: options.background ?? '#000',
      contain: 'strict',
      cursor: 'none',
    });
    options.container.appendChild(this.layer);
  }

  prepare(stimuli: Record<string, VisualStimulusSpec>): void {
    for (const [id, spec] of Object.entries(stimuli)) {
      const node = buildNode(this.layer.ownerDocument, spec);
      node.dataset.stimulus = id;
      node.style.visibility = 'hidden';
      this.layer.appendChild(node);
      this.nodes.set(id, node);
    }
    // Force style/layout once so the first presentation does no extra work.
    void this.layer.offsetHeight;
  }

  show(stimulusId: string): void {
    const node = this.nodes.get(stimulusId);
    if (!node) throw new Error(`stimulus ${stimulusId} was not prepared`);
    if (this.visible && this.visible !== node) this.visible.style.visibility = 'hidden';
    node.style.visibility = 'visible';
    this.visible = node;
  }

  clear(): void {
    if (this.visible) this.visible.style.visibility = 'hidden';
    this.visible = null;
  }

  get current(): string | null {
    return this.visible?.dataset.stimulus ?? null;
  }

  dispose(): void {
    this.layer.remove();
    this.nodes.clear();
    this.visible = null;
  }
}

function buildNode(doc: Document, spec: VisualStimulusSpec): HTMLElement {
  const el = doc.createElement('div');
  const size = `${spec.sizePx}px`;
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: size,
    height: size,
    transform: 'translate(-50%, -50%)',
    willChange: 'visibility',
  });
  switch (spec.shape) {
    case 'circle':
      el.style.background = spec.color;
      el.style.borderRadius = '50%';
      break;
    case 'square':
      el.style.background = spec.color;
      break;
    case 'diamond':
      el.style.background = spec.color;
      el.style.transform = 'translate(-50%, -50%) rotate(45deg)';
      break;
    case 'triangle':
      el.style.background = spec.color;
      el.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)';
      break;
    case 'text':
      Object.assign(el.style, {
        color: spec.color,
        fontSize: `${Math.round(spec.sizePx * 0.8)}px`,
        lineHeight: size,
        textAlign: 'center',
        fontWeight: '700',
        fontFamily: 'Vazirmatn, Tahoma, sans-serif',
      });
      el.textContent = spec.text ?? '';
      break;
  }
  return el;
}
