import { Hono } from 'hono';
import { A2AService } from '../services/a2a.js';
import { ListRegistry } from '../services/watchlist-updater.js';
export interface A2ABindings {
    WATCHLIST?: ListRegistry;
}
export declare function createA2ARoutes(a2aService?: A2AService): Hono<{
    Bindings: A2ABindings;
}, import("hono/types").BlankSchema, "/">;
declare const a2aApp: Hono<{
    Bindings: A2ABindings;
}, import("hono/types").BlankSchema, "/">;
export default a2aApp;
