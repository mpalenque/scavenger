// data.js
// Central data source: pieces, clues and trivia questions

export const PIECES = [
  { id: 'piece_1', name: 'Piece 1' },
  { id: 'piece_2', name: 'Piece 2' },
  { id: 'piece_3', name: 'Piece 3' },
  { id: 'piece_4', name: 'Piece 4' },
  { id: 'piece_5', name: 'Piece 5' },
  { id: 'piece_6', name: 'Piece 6' },
  { id: 'piece_7', name: 'Piece 7' }
];

// Definiciones geométricas del tangram tradicional
// Basado exactamente en las coordenadas del ejemplo.html
export const TANGRAM_PIECES = {
  // Los vértices están definidos para formar un cuadrado de 4x4 unidades centrado en el origen
  piece_1: { // Triángulo Grande (Verde) - parte superior
    vertices: [[-2, 2], [2, 2], [0, 0]],
    color: 0x32CD32,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'triangle_large'
  },
  piece_2: { // Triángulo Grande (Amarillo) - lado izquierdo
    vertices: [[-2, -2], [-2, 2], [0, 0]],
    color: 0xFFD700,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'triangle_large'
  },
  piece_3: { // Triángulo Mediano (Celeste) - centro inferior
    vertices: [[-1, -1], [1, -1], [0, 0]],
    color: 0x00BFFF,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'triangle_medium'
  },
  piece_4: { // Triángulo Pequeño (Azul) - esquina superior derecha
    vertices: [[1, 1], [2, 2], [2, 0]],
    color: 0x0000FF,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'triangle_small'
  },
  piece_5: { // Triángulo Mediano (Naranja) - lado inferior derecho
    vertices: [[0, -2], [2, -2], [2, 0]],
    color: 0xFFA500,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'triangle_medium'
  },
  piece_6: { // Cuadrado (Rojo) - centro derecho
    vertices: [[0, 0], [1, 1], [2, 0], [1, -1]],
    color: 0xDC143C,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'square'
  },
  piece_7: { // Paralelogramo (Rosa/Magenta) - parte inferior izquierda
    vertices: [[-2, -2], [0, -2], [1, -1], [-1, -1]],
    color: 0xFF69B4,
    finalPosition: { x: 0, y: 0, z: 0 }, // Sin rotación, posición en el origen
    type: 'parallelogram'
  }
};

export const CLUES = {
  piece_1: 'Find Piece 1',
  piece_2: 'Find Piece 2',
  piece_3: 'Find Piece 3',
  piece_4: 'Find Piece 4',
  piece_5: 'Find Piece 5',
  piece_6: 'Find Piece 6',
  piece_7: 'Find Piece 7'
};

export const TRIVIA = {
  piece_1: {
    question: 'What is the primary color of the ocean?',
    options: ['Green', 'Blue', 'Red', 'Yellow'],
    correctIndex: 1
  },
  piece_2: {
    question: 'What do you call a group of people working together?',
    options: ['Crowd', 'Team', 'Audience', 'Family'],
    correctIndex: 1
  },
  piece_3: {
    question: 'What type of energy powers most electronic devices?',
    options: ['Solar', 'Wind', 'Electrical', 'Nuclear'],
    correctIndex: 2
  },
  piece_4: {
    question: 'What is the most popular hot beverage in offices?',
    options: ['Tea', 'Coffee', 'Hot chocolate', 'Soup'],
    correctIndex: 1
  },
  piece_5: {
    question: 'What color do you get when you mix blue and yellow?',
    options: ['Purple', 'Orange', 'Green', 'Red'],
    correctIndex: 2
  },
  piece_6: {
    question: 'What do people do during a break?',
    options: ['Work harder', 'Relax', 'Run', 'Study'],
    correctIndex: 1
  },
  piece_7: {
    question: 'What do you use to leave a building?',
    options: ['Window', 'Wall', 'Exit', 'Ceiling'],
    correctIndex: 2
  }
};

export function getInitialState() {
  return {
    obtained: {}, // { piece_1: true, ... }
    completed: false,
    lastUpdated: Date.now()
  };
}

export const STORAGE_KEY = 'qr_puzzle_state_v1';
