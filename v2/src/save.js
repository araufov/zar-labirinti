// SaveManager: localStorage ustidan xavfsiz o‘rash (store). Kalitlar: jl_cfg4, jl_best_*, jl_tut, jl_daily, jl_ach, jl_map, jl_mute, jl_amb, jl_lowfx, jl_zoom2, jl_tag, jl_players, jl_diff.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
};
export { store };
