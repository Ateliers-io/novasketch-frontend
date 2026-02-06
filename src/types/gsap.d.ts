declare module 'gsap' {
    export interface TweenVars {
        [key: string]: any;
    }

    export interface Tween {
        play(): Tween;
        pause(): Tween;
        reverse(): Tween;
        restart(includeDelay?: boolean, suppressEvents?: boolean): Tween;
        kill(): Tween;
    }

    export interface Timeline extends Tween {
        to(targets: any, vars: TweenVars, position?: string | number): Timeline;
        from(targets: any, vars: TweenVars, position?: string | number): Timeline;
        fromTo(targets: any, fromVars: TweenVars, toVars: TweenVars, position?: string | number): Timeline;
        add(child: any, position?: string | number): Timeline;
        addLabel(label: string, position?: string | number): Timeline;
        addPause(position?: string | number, callback?: () => void): Timeline;
    }

    export namespace core {
        type Timeline = gsap.Timeline;
        type Tween = gsap.Tween;
    }

    export interface Context {
        revert(): void;
        kill(): void;
    }

    interface GSAPUtils {
        selector(scope?: Element | string | null): (selector: string) => Element[];
        toArray<T>(value: T | T[] | string | NodeList): T[];
    }

    interface GSAP {
        to(targets: any, vars: TweenVars): Tween;
        from(targets: any, vars: TweenVars): Tween;
        fromTo(targets: any, fromVars: TweenVars, toVars: TweenVars): Tween;
        timeline(vars?: TweenVars): Timeline;
        context(func: () => void, scope?: Element | string | null): Context;
        set(targets: any, vars: TweenVars): Tween;
        killTweensOf(targets: any, props?: string | object): void;
        utils: GSAPUtils;
        registerPlugin(...plugins: any[]): void;
    }

    const gsap: GSAP;
    export default gsap;
}
