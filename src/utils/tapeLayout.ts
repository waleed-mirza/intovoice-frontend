/** Shared viewport shell for the immersive tape feed (header + mobile nav aware). */
export const TAPE_FEED_SHELL =
  "fixed inset-x-0 z-20 flex flex-col overflow-hidden bg-gray-50 " +
  "top-[calc(3.5rem+env(safe-area-inset-top,0px))] " +
  "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] " +
  "sm:top-14 sm:bottom-16 " +
  "lg:left-64 lg:bottom-5";

/** Each full-viewport snap slide in the feed */
export const TAPE_SLIDE_SHELL =
  "h-full min-h-full shrink-0 snap-start snap-always snap-stop-always w-full flex flex-col";

/** Mobile: fill slide height. Desktop: fixed 9:16 column width */
export const TAPE_PLAYER_WRAP =
  "flex flex-1 min-h-0 flex-col w-full min-w-0 " +
  "md:flex-none md:flex-shrink-0 md:w-[min(360px,calc((100dvh-10rem)*9/16))] " +
  "lg:w-[min(420px,calc((100dvh-8rem)*9/16))]";

/** Mobile: edge-to-edge fill. Desktop: 9:16 card */
export const TAPE_PLAYER_CLASS =
  "relative flex-1 min-h-0 w-full overflow-hidden rounded-none bg-gray-900 " +
  "cursor-pointer group touch-pan-y " +
  "md:flex-none md:aspect-[9/16] md:h-auto md:rounded-2xl md:shadow-lg md:border md:border-gray-200";

/** Bottom padding for tape upload / forms above mobile nav */
export const TAPE_FORM_PAGE =
  "max-w-2xl mx-auto px-4 py-5 sm:py-6 " +
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-24";
