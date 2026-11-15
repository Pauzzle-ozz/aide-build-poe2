// Petit pont Lua -> JS (via fengari) pour lire les fichiers de données de Path of Building.
import fs from 'node:fs';
import fengari from 'fengari';

const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

function toJs(L, idx, depth = 0) {
  const t = lua.lua_type(L, idx);
  switch (t) {
    case lua.LUA_TNIL: return null;
    case lua.LUA_TBOOLEAN: return lua.lua_toboolean(L, idx);
    case lua.LUA_TNUMBER: return lua.lua_tonumber(L, idx);
    case lua.LUA_TSTRING: return to_jsstring(lua.lua_tostring(L, idx));
    case lua.LUA_TTABLE: {
      if (depth > 40) return null;
      const absIdx = lua.lua_absindex(L, idx);
      const obj = {};
      let isArray = true;
      let count = 0;
      lua.lua_pushnil(L);
      while (lua.lua_next(L, absIdx) !== 0) {
        // clé en -2, valeur en -1
        let key;
        if (lua.lua_type(L, -2) === lua.LUA_TNUMBER) {
          key = lua.lua_tonumber(L, -2);
        } else if (lua.lua_type(L, -2) === lua.LUA_TSTRING) {
          key = to_jsstring(lua.lua_tostring(L, -2));
          isArray = false;
        } else {
          key = String(lua.lua_topointer(L, -2));
          isArray = false;
        }
        obj[key] = toJs(L, -1, depth + 1);
        count++;
        lua.lua_pop(L, 1);
      }
      if (isArray && count > 0) {
        const arr = [];
        for (let i = 1; i <= count; i++) {
          if (!(i in obj)) return obj;
          arr.push(obj[i]);
        }
        return arr;
      }
      return obj;
    }
    case lua.LUA_TFUNCTION: return '[function]';
    default: return null;
  }
}

/**
 * Exécute un fichier Lua et renvoie sa valeur de retour convertie en JS.
 * - `prelude` : code Lua exécuté avant (définitions de stubs globaux)
 * - `callWith` : si le fichier renvoie une fonction, code Lua qui l'appelle et renvoie le résultat.
 *   Le résultat du fichier est disponible dans la variable `__ret`.
 */
export function evalLuaFile(file, { prelude = '', callWith = null } = {}) {
  const code = fs.readFileSync(file, 'utf8');
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const run = (src, name) => {
    if (lauxlib.luaL_loadbuffer(L, to_luastring(src), null, to_luastring(name)) !== lua.LUA_OK) {
      throw new Error(`Lua (chargement ${name}) : ${to_jsstring(lua.lua_tostring(L, -1))}`);
    }
    if (lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
      throw new Error(`Lua (exécution ${name}) : ${to_jsstring(lua.lua_tostring(L, -1))}`);
    }
  };
  if (prelude) {
    run(prelude, 'prelude');
    lua.lua_pop(L, 1);
  }
  run(code, file);
  lua.lua_setglobal(L, to_luastring('__ret'));
  run(callWith || 'return __ret', 'call');
  return toJs(L, -1);
}
