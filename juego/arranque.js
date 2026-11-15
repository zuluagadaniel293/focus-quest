// Arranque del juego (va al final, después de cargar todo lo demás).

const SCENES = [BootScene, ModeScene, MenuScene, MinigameSelectScene, WorldMapScene, ChapterMapScene, StoryScene,
  GameScene, ResultsScene, ChallengeResultsScene, StoryResultsScene, MemoryScene, MemoryResultsScene, PruebaSelectScene, PauseScene, WorldUnlockedScene, PlayersScene];

// Alta resolución: el lienzo mide RES veces 960x540 y cada escena hace zoom x RES centrada,
// así todo se sigue diseñando en 960x540 pero las imágenes y textos se ven nítidos en pantallas grandes.
SCENES.forEach(S => {
  const create = S.prototype.create;
  S.prototype.create = function (...args) {
    this.cameras.main.setZoom(RES).centerOn(GAME_W / 2, GAME_H / 2);
    return create.apply(this, args);
  };
});
// Los textos se generan también a RES, para que no se vean borrosos con el zoom.
// Solo en WebGL (versión publicada): en modo Canvas (doble clic) Phaser los dibujaría al doble de tamaño.
const addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (...args) {
  const t = addText.apply(this, args);
  return this.scene.sys.game.renderer.type === Phaser.WEBGL ? t.setResolution(RES) : t;
};

// Abierto con doble clic (file://), Chrome no deja usar imágenes en WebGL: se usa el modo Canvas.
// En iPhone y iPad también: Safari le da poca memoria a WebGL y, con las imágenes de los 9 mundos cargadas, la
// pierde después de un rato y la pantalla se congela en el último cuadro (pasaba en el "¡Ya!" del jefe final).
// window.juego queda accesible para las herramientas (por ejemplo, exportar las imágenes a Figma).
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.juego = new Phaser.Game({
  type: location.protocol === 'file:' || IS_IOS ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RES,
  height: GAME_H * RES,
  backgroundColor: '#0f172a',
  loader: { imageLoadType: 'HTMLImageElement' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: SCENES
});

// Si en algún otro equipo el navegador se queda sin memoria de video (WebGL "perdido"), la pantalla quedaría
// congelada: mejor avisar y recargar. El progreso y las partidas ya están guardados.
window.juego.events.once('ready', () => {
  const cv = window.juego.canvas;
  if (!cv || window.juego.renderer.type !== Phaser.WEBGL) return;
  cv.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (document.getElementById('recargar')) return;
    const d = document.createElement('div');
    d.id = 'recargar';
    d.style.cssText = 'position:fixed;inset:0;z-index:60;background:#0f172a;color:#fde047;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:14px;font:bold 26px Arial,sans-serif;text-align:center;padding:24px;cursor:pointer';
    d.innerHTML = '<div style="font-size:64px">🔄</div><div>Toca para seguir jugando</div>' +
      '<small style="color:#cbd5e1;font-size:17px;font-weight:normal">Tu progreso está guardado</small>';
    d.onclick = () => location.reload();
    document.body.appendChild(d);
  });
});
