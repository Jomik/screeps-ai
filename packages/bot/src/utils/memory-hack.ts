declare const global: { Memory?: Memory };

// Adapted from https://github.com/screepers/screeps-snippets/blob/8b557a3fcb82cb734fca155b07d5a48622f9da60/src/misc/JavaScript/Memory%20Cache.js
export const wrapWithMemoryHack = (fn: () => void) => {
  const memory = Memory;

  return () => {
    delete global.Memory;
    global.Memory = memory;

    fn();

    const start = Game.cpu.getUsed();
    // there are two ways of saving Memory with different advantages and disadvantages
    // 1. RawMemory.set(JSON.stringify(Memory));
    // + ability to use custom serialization method
    // - you have to pay for serialization
    // - unable to edit Memory via Memory watcher or console
    // 2. RawMemory._parsed = Memory;
    // - undocumented functionality, could get removed at any time
    // + the server will take care of serialization, it doesn't cost any CPU on your site
    // + maintain full functionality including Memory watcher and console

    // this implementation uses the official way of saving Memory
    RawMemory.set(JSON.stringify(Memory));
    const end = Game.cpu.getUsed();

    const visuals = new RoomVisual();
    visuals.text(
      `Memory stringify: ${(end - start).toFixed(2).toString()}`,
      0,
      1.2,
      { font: 0.7, align: 'left' }
    );
  };
};
