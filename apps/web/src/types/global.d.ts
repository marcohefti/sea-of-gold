export {};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void | Promise<void>;
    __idle: {
      version: string;
      exportSave: () => string;
      importSave: (save: string) => void;
      hardReset: () => void;
      setSeed: (seed: number) => void;
      validate?: () => { ok: boolean; errors: string[]; warnings: string[] };
      debug?: {
        getLog: () => unknown[];
        clear: () => void;
      };
    };
  }
}
