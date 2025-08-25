
class Key {
    static keys = {};
    static {
        document.addEventListener("keydown", (e) => { if (!e.repeat) Key.keys[e.code] = true; });
        document.addEventListener("keyup", (e) => { Key.keys[e.code] = false; });
    }
    static Down(key) { return !!Key.keys[key]; }
    static Once(key) {
        const down = !!Key.keys[key];
        Key.keys[key] = false;
        return down;
    }
}

export {Key};