// Kenney Sci-Fi Sounds 1.0, CC0. See public/media/audio/kenney/License.txt.
export const soundFiles = [
  'laserSmall_000',
  'laserSmall_001',
  'laserSmall_002',
  'laserLarge_000',
  'laserLarge_001',
  'laserLarge_002',
  'laserRetro_000',
  'laserRetro_001',
  'laserRetro_002',
  'impactMetal_000',
  'impactMetal_001',
  'impactMetal_002',
  'explosionCrunch_000',
  'explosionCrunch_001',
  'lowFrequency_explosion_000',
  'forceField_000',
  'forceField_001',
  'forceField_002',
  'thrusterFire_000',
  'spaceEngineSmall_000',
  'computerNoise_000',
] as const;
export type SoundFile = (typeof soundFiles)[number];

export const weaponSounds: {
  file: SoundFile;
  gain: number;
  rate: number;
  duration: number;
}[] = [
  { file: 'laserSmall_000', gain: 0.72, rate: 1.1, duration: 0.22 },
  { file: 'laserLarge_000', gain: 0.8, rate: 0.73, duration: 0.5 },
  { file: 'laserLarge_002', gain: 0.85, rate: 1.28, duration: 0.6 },
  { file: 'thrusterFire_000', gain: 0.8, rate: 0.8, duration: 0.4 },
  { file: 'laserRetro_000', gain: 0.65, rate: 1.3, duration: 0.28 },
  { file: 'thrusterFire_000', gain: 0.32, rate: 1.5, duration: 0.16 },
  { file: 'laserRetro_001', gain: 0.68, rate: 0.7, duration: 0.35 },
  { file: 'forceField_002', gain: 0.65, rate: 1.25, duration: 0.5 },
];
