import * as bcrypt from '../password.js';
import { id, now } from '../utils.js';

export async function seedDatabase(db) {
  if (process.env.SEED_DEMO === 'false' || (await db.get('SELECT id FROM users'))) return;
  const password = await bcrypt.hash('Teamup123!');
  const people = [
    [
      'demo-student',
      'student@teamup.mn',
      'А. Анударь',
      'МУИС',
      'Мэдээллийн систем',
      ['React', 'Figma'],
      'student',
    ],
    [
      'demo-owner',
      'owner@teamup.mn',
      'Б. Тэмүүлэн',
      'МУИС',
      'Программ хангамж',
      ['React', 'TypeScript'],
      'student',
    ],
    [
      'demo-nomin',
      'nomin@teamup.mn',
      'С. Номин',
      'ШУТИС',
      'Бизнесийн удирдлага',
      ['Marketing', 'Figma'],
      'student',
    ],
    [
      'demo-bat',
      'bat@teamup.mn',
      'Э. Батбаяр',
      'ХААИС',
      'Электроникийн инженер',
      ['Python', 'IoT'],
      'student',
    ],
    [
      'demo-munkh',
      'munkh@teamup.mn',
      'Г. Мөнхзул',
      'АШУҮИС',
      'Хүний их эмч',
      ['Research', 'Figma'],
      'student',
    ],
    ['demo-admin', 'admin@teamup.mn', 'Системийн админ', 'TeamUp', 'Удирдлага', [], 'admin'],
  ];
  await db.transaction(async () => {
    for (const [userId, email, name, school, major, skills, role] of people) {
      await db.insert('users', {
        id: userId,
        email,
        password,
        name,
        school,
        major,
        skills: JSON.stringify(skills),
        interests: JSON.stringify(['EdTech', 'GreenTech']),
        experience: '1 жил',
        portfolio: '',
        hours: 12,
        bio: 'Шинэ санааг бодит бүтээгдэхүүн болгох хүсэлтэй. Хамтдаа суралцаж, хамтдаа бүтээе.',
        role,
        status: 'active',
        verified: 1,
        created_at: now(),
      });
    }
    const projects = [
      [
        'demo-events',
        'demo-owner',
        'Оюутны арга хэмжээний платформ',
        'Их сургуулийн оюутны клуб, соёлын арга хэмжээ, воркшопуудыг нэг дороос бүртгэж, тасалбар захиалах платформ.',
        'EdTech',
        ['React', 'Figma', 'TypeScript'],
        ['Frontend хөгжүүлэгч', 'UI/UX дизайнер'],
        5,
        3,
      ],
      [
        'demo-nomad',
        'demo-nomin',
        'NomadPay — Оюутны хөнгөлөлтийн апп',
        'Оюутны үнэмлэхэд суурилсан хоол, ном, унааны хөнгөлөлтийг нэг дор нэгтгэх дижитал шийдэл.',
        'FinTech',
        ['Flutter', 'Node.js', 'Marketing'],
        ['Сошиал медиа менежер'],
        5,
        4,
      ],
      [
        'demo-eco',
        'demo-bat',
        'EcoCampus — Ногоон кампус',
        'Кампус доторх хуванцар, цаас ангилан цуглуулах урамшууллын ухаалаг систем болон IoT төхөөрөмж.',
        'GreenTech',
        ['Python', 'IoT', 'Research'],
        ['Электроникийн инженер', 'Төслийн менежер'],
        4,
        2,
      ],
      [
        'demo-medtutor',
        'demo-munkh',
        'MedTutor — Хамтдаа суралцъя',
        'Анагаахын оюутнуудад зориулсан клиник кейс шинжилгээ, анатомийн сорил, шалгалтын хамтын бэлтгэл.',
        'HealthTech',
        ['React', 'Figma', 'Research'],
        ['Веб хөгжүүлэгч', 'Дизайнер', 'Контент бүтээгч'],
        4,
        1,
      ],
      [
        'demo-study',
        'demo-student',
        'StudyBuddy — Суралцах хамтрагч',
        'Оюутнууд хичээлээрээ нэгдэж, мэдлэгээ хуваалцах жижиг бүлгийн суралцах орчин.',
        'EdTech',
        ['React', 'Node.js'],
        ['Backend хөгжүүлэгч', 'Дизайнер'],
        4,
        2,
      ],
      [
        'demo-campus',
        'demo-owner',
        'Campus Map — Кампусын хөтөч',
        'Шинэ оюутнуудад анги танхим, номын сан, үйлчилгээний байршлыг хялбар олоход тусална.',
        'Social',
        ['Figma', 'TypeScript'],
        ['UI/UX дизайнер'],
        3,
        2,
      ],
    ];
    for (const [
      projectId,
      owner,
      name,
      description,
      category,
      skills,
      roles,
      capacity,
      count,
    ] of projects) {
      await db.insert('projects', {
        id: projectId,
        owner_id: owner,
        name,
        description,
        category,
        project_type: 'Стартап',
        goal:
          'Оюутнуудын бодит хэрэгцээнд нийцсэн анхны бүтээгдэхүүнийг багаараа хөгжүүлж, хэрэглэгчдээр турших.',
        duration: 12,
        capacity,
        skills: JSON.stringify(skills),
        roles: JSON.stringify(roles),
        hours: 8,
        status: 'open',
        visibility: 'visible',
        created_at: now(),
      });
      const members = [
        owner,
        ...people
          .map(person => person[0])
          .filter(
            userId => userId !== owner && userId !== 'demo-admin' && userId !== 'demo-student'
          ),
      ];
      if (projectId === 'demo-eco') members[1] = 'demo-student';
      for (const [index, userId] of members.slice(0, count).entries()) {
        await db.insert('memberships', {
          id: id(),
          project_id: projectId,
          user_id: userId,
          role: index === 0 ? 'Төсөл эзэмшигч' : 'Судлаач',
          created_at: now(),
        });
      }
      await db.insert('messages', {
        id: id(),
        project_id: projectId,
        user_id: owner,
        body:
          'Сайн байцгаана уу! Багийнхаа ажлыг энд ярилцаж, санаа болон материалаа хуваалцаарай. 🚀',
        visibility: 'visible',
        created_at: now(),
      });
    }
    await db.insert('applications', {
      id: id(),
      project_id: 'demo-study',
      user_id: 'demo-nomin',
      role: 'Дизайнер',
      introduction:
        'Сайн байна уу? Figma дээр интерфейсийн дизайн хийдэг. Танай төсөлд хувь нэмрээ оруулах хүсэлтэй байна.',
      status: 'pending',
      question: '',
      answer: '',
      reason: '',
      created_at: now(),
    });
    await db.insert('notifications', {
      id: id(),
      user_id: 'demo-student',
      title: 'StudyBuddy төсөлд шинэ хүсэлт ирлээ.',
      link: '/requests?tab=incoming',
      is_read: 0,
      created_at: now(),
    });
    for (const [code, name, type] of [
      ['react', 'React', 'skill'],
      ['figma', 'Figma', 'skill'],
      ['edtech', 'EdTech', 'category'],
      ['greentech', 'GreenTech', 'category'],
    ]) {
      await db.insert('reference_data', { id: id(), code, name, type });
    }
  });
  console.log('Demo accounts: student@teamup.mn / owner@teamup.mn / admin@teamup.mn · Teamup123!');
}
