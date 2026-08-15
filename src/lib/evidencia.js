// ------------------------------------------------------------------
// Fundamento científico del sistema.
//
// Está dentro de la app y no solo en un documento porque es lo que hace
// que las decisiones raras del diseño (por qué el elogio pide detalle,
// por qué los premios buenos son "elegir algo", por qué hay que ir
// retirándolos) se entiendan en el momento en que chirrían.
//
// Solo revisiones sistemáticas, metaanálisis y trabajos fundacionales.
// ------------------------------------------------------------------

export const PRINCIPIOS = [
  {
    id: 'esfuerzo',
    titulo: 'Reforzar el esfuerzo, no solo el resultado',
    detalle:
      'Lo que se refuerza es lo que se repite. Si solo se premia la cama hecha, se aprende a hacer la cama; si se reconoce la constancia, se aprende a sostener.'
  },
  {
    id: 'elogio',
    titulo: 'Elogio específico, no "muy bien"',
    detalle:
      'El elogio genérico pierde efecto por repetición. "Has recogido todos los juguetes sin que nadie te lo recordara" dice qué hizo bien y se puede repetir.'
  },
  {
    id: 'eleccion',
    titulo: 'Poder elegir algunas misiones',
    detalle:
      'La autonomía es una de las tres necesidades que sostienen un hábito. Un tablón impuesto entero se abandona antes.'
  },
  {
    id: 'equipo',
    titulo: 'Hacerlo como equipo',
    detalle:
      'La meta del gremio existe para que el sistema no sea cada uno contra su lista. Sin ranking entre miembros, a propósito.'
  },
  {
    id: 'experiencia',
    titulo: 'Premios que son planes, no cosas',
    detalle:
      'Elegir la película, cocinar juntos, una excursión. Se disfrutan, no se acumulan y no pierden valor con el uso.'
  },
  {
    id: 'retirada',
    titulo: 'Retirar la recompensa cuando el hábito ya anda solo',
    detalle:
      'La recompensa externa es un andamio. Cuando la conducta se sostiene sin ella, se quita y se deja el reconocimiento.'
  },
  {
    id: 'previsible',
    titulo: 'Reglas previsibles',
    detalle:
      'Las mismas consecuencias, con el mismo tono, independientemente del día que hayan tenido los adultos.'
  }
]

export const REFERENCIAS = [
  {
    id: 'leijten2019',
    cita:
      'Leijten P, Gardner F, Melendez-Torres GJ, et al. Meta-Analyses: Key Parenting Program Components for Disruptive Child Behavior. JAMA Psychiatry. 2019;76(2):180-190.',
    pmid: '30738545',
    aporta:
      'Metaanálisis de 154 ensayos. Los componentes con más efecto son el refuerzo positivo, el elogio específico, las consecuencias naturales y lógicas, y la autorregulación de los adultos.',
    enElGremio:
      'El panel pide un elogio concreto al validar, y no existe ningún mecanismo de castigo: un rechazo solo devuelve la misión a la lista.'
  },
  {
    id: 'brown2018',
    cita:
      'Brown EM, Smith DM, Epton T, Armitage CJ. Do Self-Incentives and Self-Rewards Change Behavior? A Systematic Review and Meta-analysis. Behav Ther. 2018;49(1):113-123.',
    pmid: '29405916',
    aporta:
      'Las recompensas por sí solas producen un efecto pequeño. Funcionan mejor como iniciadores del hábito y combinadas con otras estrategias.',
    enElGremio:
      'Las monedas son un andamio, no el motor. La tienda prioriza premios de autonomía y el sistema invita a retirar la recompensa cuando el hábito se sostiene.'
  },
  {
    id: 'leijten2018',
    cita:
      'Leijten P, et al. Parenting Behaviors That Shape Child Compliance: A Multilevel Meta-analysis. J Abnorm Child Psychol. 2018.',
    pmid: '30289928',
    aporta:
      'Lo que mejora la cooperación: instrucciones claras, consecuencias consistentes, respuestas calmadas y no entrar en discusiones.',
    enElGremio:
      'Reglas fijas y visibles: la frecuencia de cada misión, lo que vale y quién valida no cambian según el día.'
  },
  {
    id: 'owen2012',
    cita:
      'Owen DJ, Slep AMS, Heyman RE. The Effect of Praise, Positive Nonverbal Response, Reprimand, and Negative Nonverbal Response on Child Compliance: A Systematic Review. Clin Child Fam Psychol Rev. 2012;15(4):364-385.',
    pmid: '22918669',
    aporta:
      'Revisión de 41 estudios. El elogio funciona cuando es específico, sincero e inmediato; el "muy bien" genérico pierde eficacia.',
    enElGremio:
      'Al validar, el panel ofrece elogios concretos ligados a la misión y deja escribir uno propio. El elogio llega a su pantalla con la estrella.'
  },
  {
    id: 'pei2018',
    cita:
      'Pei L, et al. The Effects of Primary Care-Based Parenting Interventions on Parenting and Child Behavioral Outcomes: A Systematic Review. Trauma Violence Abuse. 2018.',
    pmid: '30064299',
    aporta:
      'Las intervenciones de crianza positiva mejoran la relación, reducen problemas de conducta y aumentan la autonomía.',
    enElGremio:
      'El objetivo declarado del sistema no es que obedezcan, es que desarrollen habilidades. De ahí que las misiones se agrupen por habilidad y no por zona de la casa.'
  },
  {
    id: 'ryan2000',
    cita:
      'Ryan RM, Deci EL. Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being. Am Psychol. 2000;55(1):68-78.',
    pmid: null,
    aporta:
      'Trabajo fundacional. Un hábito se sostiene cuando se satisfacen tres necesidades: autonomía, competencia y relación.',
    enElGremio:
      'Autonomía: se eligen misiones y premios. Competencia: las barras de habilidad hacen visible el progreso. Relación: la meta del gremio es cooperativa y no hay ranking.'
  }
]

export const LIMITE_HONESTO =
  'Nada de esto convierte una app en una intervención clínica. Son principios de diseño tomados de la literatura sobre crianza y motivación, aplicados a un juego de casa para cuatro personas.'
