// Guards an async WhatsApp link-code request against account switches: a
// response is applied only if no newer request started and the panel was not
// invalidated (unmounted / user changed) in the meantime.
export class LinkCodeRequestGuard {
  private generation = 0;

  /** Start a request; returns its token. Any earlier token becomes stale. */
  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  /** The owner changed (account switch / unmount): every in-flight token is stale. */
  invalidate(): void {
    this.generation += 1;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }
}
