const GAP_PX = 6;
const SCALE_STEP = 0.08;
const BASE_MIN_HEIGHT_PX = 64;
const EXIT_LIFT_PX = 6;

function getStack(stackEl: HTMLElement): HTMLElement[] {
    return Array.from(stackEl.children).filter(
        (el) => !(el as HTMLElement).classList.contains('toast-exiting'),
    ) as HTMLElement[];
}

function layoutStack(stackEl: HTMLElement) {
    const toasts = getStack(stackEl);
    const n = toasts.length;

    if (n === 0) {
        stackEl.style.paddingTop = '';
        stackEl.style.minHeight = '';
        return;
    }

    const padTop = Math.max(0, n - 1) * GAP_PX;
    stackEl.style.paddingTop = `${padTop}px`;
    stackEl.style.minHeight = `${BASE_MIN_HEIGHT_PX + padTop}px`;

    toasts.forEach((el, j) => {
        const depth = n - 1 - j;
        const scale = 1 - depth * SCALE_STEP;
        const translateY = -depth * GAP_PX;
        el.style.zIndex = String(10 + j);
        el.style.transform = `translateY(${translateY}px) scale(${scale})`;
        el.style.pointerEvents = depth === 0 ? 'auto' : 'none';
    });
}

function parseStackTransform(transform: string): { ty: number; scale: number } {
    const tyMatch = /translateY\((-?[\d.]+)px\)/.exec(transform);
    const scaleMatch = /scale\(([\d.]+)\)/.exec(transform);
    return {
        ty: tyMatch ? parseFloat(tyMatch[1]) : 0,
        scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
    };
}

export default function toast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const stackEl = document.getElementById('toast-stack');
    if (!stackEl) return;

    const el = document.createElement('div');
    el.className =
        'toast-item pointer-events-auto absolute left-0 right-0 top-0 w-full origin-top rounded-lg border border-gray-200 p-4 text-gray-800 shadow-md transition-[transform,opacity] duration-300 ease-out';

    switch (type) {
        case 'success':
            el.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            el.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            el.classList.add('bg-yellow-500', 'text-white');
            break;
        case 'info':
            el.classList.add('bg-blue-500', 'text-white');
            break;
        default:
            el.classList.add('bg-gray-500', 'text-white');
            break;
    }

    el.textContent = message;
    el.style.opacity = '0';
    el.style.transition = 'none';

    stackEl.appendChild(el);

    layoutStack(stackEl);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.transition = '';
            el.style.opacity = '1';
        });
    });

    setTimeout(() => {
        el.classList.add('toast-exiting');
        el.style.pointerEvents = 'none';
        layoutStack(stackEl);

        const { ty, scale } = parseStackTransform(el.style.transform);
        el.style.transition = 'opacity 320ms ease-out, transform 320ms cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.opacity = '0';
        el.style.transform = `translateY(${ty - EXIT_LIFT_PX}px) scale(${scale * 0.88})`;

        setTimeout(() => {
            el.remove();
            layoutStack(stackEl);
        }, 320);
    }, 2000);
}
