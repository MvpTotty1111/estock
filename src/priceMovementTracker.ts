export type PriceMovementDirection = 'up' | 'down';

export interface PriceMovementAlert {
  direction: PriceMovementDirection;
  percent: number;
}

interface PriceMovementTrackerOptions {
  thresholdPercent: number;
  windowMs?: number;
  extensionStepPercent?: number;
}

interface PriceSample {
  price: number;
  timestamp: number;
}

interface SymbolMovementState {
  samples: PriceSample[];
  startedAt: number;
  armed: boolean;
  direction?: PriceMovementDirection;
  peakPercent?: number;
}

/** 跟踪滚动时间窗口内的价格异动，不依赖任何 UI 状态。 */
export class PriceMovementTracker {
  private readonly thresholdPercent: number;
  private readonly windowMs: number;
  private readonly extensionStepPercent: number;
  private readonly states = new Map<string, SymbolMovementState>();

  constructor(options: PriceMovementTrackerOptions) {
    this.thresholdPercent = options.thresholdPercent;
    this.windowMs = options.windowMs ?? 60_000;
    this.extensionStepPercent = options.extensionStepPercent ?? 0.1;
  }

  record(symbol: string, price: number, timestamp: number): PriceMovementAlert | undefined {
    if (!Number.isFinite(price) || price <= 0) return undefined;

    const state = this.states.get(symbol) ?? {
      samples: [],
      startedAt: timestamp,
      armed: true,
    };
    const targetTimestamp = timestamp - this.windowMs;
    state.samples = state.samples.filter(sample => sample.timestamp >= targetTimestamp);
    state.samples.push({ price, timestamp });
    this.states.set(symbol, state);

    if (timestamp - state.startedAt < this.windowMs) return undefined;

    const baseline = this.findBaseline(state.samples, targetTimestamp, timestamp);
    if (!baseline || baseline.price <= 0) return undefined;

    const rawPercent = ((price - baseline.price) / baseline.price) * 100;
    const signedPercent = Math.round(rawPercent * 100) / 100;
    const percent = Math.abs(signedPercent);
    if (percent < this.thresholdPercent) {
      state.armed = true;
      state.direction = undefined;
      state.peakPercent = undefined;
      return undefined;
    }

    const direction: PriceMovementDirection = signedPercent >= 0 ? 'up' : 'down';
    if (state.armed || state.direction !== direction) {
      state.armed = false;
      state.direction = direction;
      state.peakPercent = percent;
      return { direction, percent };
    }

    if (state.peakPercent !== undefined
      && percent + Number.EPSILON >= state.peakPercent + this.extensionStepPercent) {
      state.peakPercent = percent;
      return { direction, percent };
    }

    return undefined;
  }

  clear(symbol?: string): void {
    if (symbol === undefined) {
      this.states.clear();
      return;
    }
    this.states.delete(symbol);
  }

  private findBaseline(
    samples: PriceSample[],
    targetTimestamp: number,
    currentTimestamp: number,
  ): PriceSample | undefined {
    let baseline: PriceSample | undefined;
    for (const sample of samples) {
      if (sample.timestamp < targetTimestamp || sample.timestamp >= currentTimestamp) continue;
      if (!baseline || sample.timestamp < baseline.timestamp) {
        baseline = sample;
      }
    }
    return baseline;
  }
}
