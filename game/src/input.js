// Keyboard and mouse, kept apart from the game rules: the world only ever
// sees the small action object this module hands it each step.

export const ACTION_NONE = 0;
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 3;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  const input = {
    mouseX: -1,
    mouseY: -1,
    clicked: null,
    key: null,
    actionQueue: [],
  };

  function cellFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    const pos = cellFromEvent(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
  });

  canvas.addEventListener('click', (event) => {
    const pos = cellFromEvent(event);
    input.clicked = { x: pos.x, y: pos.y };
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      input.actionQueue.push(ACTION_CONFIRM);
    } else if (key === 'p' || key === 'escape') {
      input.actionQueue.push(ACTION_PAUSE);
    } else if (key === 'r') {
      input.actionQueue.push(ACTION_RESTART);
    } else if (key === 'm') {
      input.actionQueue.push(ACTION_MUTE);
    } else {
      input.key = key;
    }
  });

  // Take everything that happened since the last step, then clear it.
  input.drain = function drain() {
    const taken = { clicked: input.clicked, key: input.key, actions: input.actionQueue.slice() };
    input.clicked = null;
    input.key = null;
    input.actionQueue.length = 0;
    return taken;
  };

  return input;
}
