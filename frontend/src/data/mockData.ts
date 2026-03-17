export const familyMembers = [
  {
    id: 'dad',
    name: 'Dad',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuACIPozHz0M0TVisxHauUcYgOUJruUkOSwGMBLSKvm9d5muomgV3taQwRojjEkDGl-N1wAbComsgOL6PBjXKakAExCNPovgGw9LC40obYXedCtppYEE_Fd1exgRWQPF97IHi02ug_r1CmzO_KnwZWRnw96HFJQzy_NNTlvWhoUoX2j7r-2-_FnhB0Rh4Y_GqxqM4LRYaD-ZeeFj7VNDYoEWpo-PxV2ostyX-AOIaIMe9TyYSix1PfUYOhlybxjq7v7dcm2f8o6-Va4m',
  },
  {
    id: 'mom',
    name: 'Mom',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDwNAtXhm1IL1G-0PdqhSMWLtpqinGzLFDe1jT668fMhPEzYrxHldxEQ16EEqsAGdEboF7Hq0d3zQrqq2A03PtL4yp_FBwOO_vUE09GqCEvam1MvfUvnckyrV9jBTyJrvN45bR1QC4v6wGXNwZsGeJhNyOC80H5ifxok-nvQ0cCUQgAYQQ5pGayE5oBLr0UnrFrmHbcUq3Sw-yfzCunnXlH_2wWyQeztmgXvAiArI2luY_FyOxqpElcKRQFYqy_qNrocZaOUbBtb9RA',
  },
  {
    id: 'leo',
    name: 'Leo',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8g5YzyRMwsodhQp4amogXWR0qotoaafBWcPhZu_mERa_Q6wJdRHTpZiVvtUDLZ_CUGga3UYpX4a0SqLVjv4k2ueyX1OqvfWGN7euZKC9HF3oUMIPvZ989y97iYHzYoNM1C2sHo0wJBFX4W4AlZFy1w5ybOqFS2Ei72d8GGmNzxxOttNWPtxOUuvy_TjXEVQv8v-U55B-sqCoBUSIRY811vpBMdYg4gqq0WMurYUFcS30Jmfw6ZYF1RZqA9mfajBdKPwo3mtO8Lgqq',
  },
  {
    id: 'mia',
    name: 'Mia',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAH4F-aAY8zpYcGl5O85btGAJpAQDSA5uqdSydYycj38wACBJaBnhDiJ8FpDUGizAK5_eiKqgp5-rDx3zBuBsVM0L_ZQ4IQBwXQYjo9ZtY0jEmnn1Kgya39EkyyrnEnvw5bp6J8imu51eQ1m55BE8BkUrqGQ46g-waKFEah-7mV8fM1VjHObzUw1e-8ljTmW5wlR0twr6ggdLbH3iP_CMsqQFs_4fzDBULWVFqIzQwIVREu6x2cO-Bjyp0ykkRI-aWeUZhgFfDfzuRd',
  },
] as const;

export const familyProfile = {
  name: 'Sarah Jenkins',
  subtitle: 'Age: 34 Years',
  imageUri:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBVT2ysMXQUwPj-4fDqET-xSCZrUNvWTkUDEqefA-wnoUAvz5w2CfgAw6AanWJp1wG-blx45moasaTKEb-j2aACjY8S5tfY-4ETUMa9OVWxCupTyJsEtm38Z5coeVlNR2Hees_DkRG5I7CKEV6VyYbuefm7eu-LYCDGERtZgRFUiS6k8VSpHnv2NIx9qsW1_Z_F801fhtGkRCdryQ6_07DrRO_NDRiVoW3KvBbuDDM-z-TSieNRHjgjZczhLLCKmZCb2CsETq27YxqD',
  notes:
    'Allergic to Penicillin. Management for mild asthma. Routine check-up scheduled for next month. Loves yoga and walking.',
  actions: ['Medical History', 'Prescriptions', 'Doctor Contacts'],
} as const;

export const friendProfile = {
  name: 'Alex Rivera',
  subtitle: 'Mock friend profile',
  imageUri: familyMembers[1].imageUri,
  notes:
    'Mock data. Friend profile extends the same Stitch profile pattern because no dedicated Stitch screen exists for this flow.',
  actions: ['Shared Notes', 'Wellness Goals', 'Emergency Contact'],
} as const;

export const dashboardActions = [
  {
    label: 'Family\nProfiles',
    route: 'FamilyProfileScreen',
    accent: 'blue' as const,
    badge: 'FP',
  },
  {
    label: 'Friend\nProfile',
    route: 'FriendProfileScreen',
    accent: 'purple' as const,
    badge: 'FR',
  },
  {
    label: 'Upload\nDocuments',
    route: 'UploadScreen',
    accent: 'red' as const,
    badge: 'UP',
  },
  {
    label: 'Processing\nStatus',
    route: 'StatusScreen',
    accent: 'amber' as const,
    badge: 'ST',
  },
  {
    label: 'Results',
    route: 'ResultScreen',
    accent: 'teal' as const,
    badge: 'RS',
  },
] as const;

export const placeholderStatus = {
  status: 'WAITING',
  progress: 0,
  note: 'Placeholder data. Upload a document to request live processing status from the status API.',
} as const;

export const placeholderResult = {
  title: 'No result yet',
  summary:
    'Placeholder data. Complete an upload and status run to fetch a live result from the result API.',
  extractedPreview: [
    'Document type: Pending',
    'Summary: Waiting for upload',
    'Structured fields: Placeholder',
  ],
} as const;
