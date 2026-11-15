// Frases que comparten todos los mundos (se graban una sola vez, en assets/voces/comunes, con la voz del narrador):
// el mensaje de "¡Mundo desbloqueado!" y las reglas de cada juego. Las risas y los "¡ayuda!" son de cada mundo
// (distractors.voices), con la voz de su villano y de su amigo.

const UNLOCK_LINE = '¡Felicidades! ¡Desbloqueaste un nuevo mundo!';

// Reglas de cada juego, en general (sin nombres de personajes, porque sirven para todos los mundos y para el
// Modo Examen) y para computador y celular a la vez. Las lee el narrador con el botón "🔊 Escuchar" de la pantalla
// de "Cómo jugar" (y solas a los niños de 7 años o menos). En pantalla siguen saliendo con los nombres de cada mundo.
// Cambiar un texto obliga a regrabarlo (gasta créditos de ElevenLabs).
const RULE_LINES = {
  classic: 'Mira bien el centro de la pantalla. Cuando aparezca el que te mostramos en verde, toca la pantalla o presiona espacio. Si sale otro, no toques nada. ¡Espera al correcto!',
  notx: 'En este juego tocas casi todo. Cada vez que aparezca algo, toca la pantalla o presiona espacio. Pero cuando salga el que te mostramos en rojo, ¡frena y no toques!',
  ax: 'Fíjate en la pista. Toca la pantalla o presiona espacio solo cuando el objetivo salga justo después de la pista. Si sale sin la pista antes, ¡no toques!',
  catch: 'Muévete de lado a lado con las flechas o con el dedo. Atrapa solo el que te mostramos en verde y esquiva todo lo demás que cae.',
  race: 'Cambia de carril con las flechas o tocando arriba o abajo de tu personaje. Alcanza solo el que te mostramos en verde y deja pasar lo demás.',
  find: 'Van a salir muchas cosas a la vez. Busca el que te mostramos en verde y tócalo. Si no está, no toques nada y espera.',
  dodge: 'Van a llegar tres poderes como sombras. A mitad de camino uno se detiene. ¡Ponte en su carril! No te muevas antes de tiempo.',
  path: 'Mira el camino que hace tu amigo de piedra en piedra. Cuando sus huellas se borren, lleva a tu personaje por el mismo camino.',
  memory: 'Mira en qué casillas aparece, una por una. Cuando termine, tócalas en el mismo orden.',
  memory_bwd: 'Ahora al revés. Toca las casillas empezando por la última que apareció y terminando en la primera.'
};
