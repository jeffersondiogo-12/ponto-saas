/** iPhone, iPod ou iPad — o iPad novo se apresenta como Mac, mas tem toque. */
export function ehIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Aberto pelo icone da tela de inicio. `navigator.standalone` e o jeito antigo do iOS. */
export function instalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
