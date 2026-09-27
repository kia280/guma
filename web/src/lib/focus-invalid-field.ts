const INVALID_FOCUS_TARGETS = [
  '[aria-invalid="true"]',
  '[data-invalid="true"] [role="spinbutton"]',
  '[data-invalid="true"] button',
].join(', ');

export const focusFirstInvalidField = (trigger: Element) => {
  const container = trigger.closest('[role="dialog"], form') ?? document;
  requestAnimationFrame(() => {
    container.querySelector<HTMLElement>(INVALID_FOCUS_TARGETS)?.focus();
  });
};
