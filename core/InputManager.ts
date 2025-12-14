export type Action = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'RESET_CAMERA';

class InputManager {
    bindings: Record<Action, string> = {
        'FORWARD': 'ArrowUp',
        'BACKWARD': 'ArrowDown',
        'LEFT': 'ArrowLeft',
        'RIGHT': 'ArrowRight',
        'UP': 'PageUp',
        'DOWN': 'PageDown',
        'RESET_CAMERA': 'r'
    };

    keyState: Record<string, boolean> = {};

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => {
                // Prevent scrolling for bound keys
                if (Object.values(this.bindings).includes(e.key)) {
                    // e.preventDefault(); 
                }
                this.keyState[e.key] = true;
            });
            window.addEventListener('keyup', (e) => {
                this.keyState[e.key] = false;
            });
        }
    }

    isPressed(action: Action): boolean {
        const key = this.bindings[action];
        return !!this.keyState[key];
    }

    rebind(action: Action, key: string) {
        this.bindings[action] = key;
    }
    
    getKey(action: Action): string {
        return this.bindings[action];
    }
    
    resetToDefaults() {
         this.bindings = {
            'FORWARD': 'ArrowUp',
            'BACKWARD': 'ArrowDown',
            'LEFT': 'ArrowLeft',
            'RIGHT': 'ArrowRight',
            'UP': 'PageUp',
            'DOWN': 'PageDown',
            'RESET_CAMERA': 'r'
        };
    }
}

export const inputManager = new InputManager();