const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CATEGORY_IDS = [
  "invest",
  "health",
  "study",
  "shopping",
  "career",
  "daily",
  "relationship",
];

const TITLE_PREFIX = "테스트 판단";

const TAGS_BY_CATEGORY = {
  invest: ["리스크", "진입", "손절", "타이밍", "지표", "포지션"],
  health: ["루틴", "수면", "운동", "식단", "회복", "컨디션"],
  study: ["집중", "계획", "복습", "몰입", "정리", "목표"],
  shopping: ["가격", "비교", "필요", "충동", "리뷰", "가성비"],
  career: ["우선순위", "피드백", "성과", "리더십", "협업", "성장"],
  daily: ["습관", "정리", "기록", "일정", "여유", "생산성"],
  relationship: ["대화", "배려", "갈등", "경청", "약속", "감정"],
};

const NOTES_BY_CATEGORY = {
  invest: [
    "진입 근거와 손절 기준을 기록했습니다.",
    "리스크를 고려했지만 변동성이 컸습니다.",
    "시장 흐름을 반영해 판단했습니다.",
  ],
  health: [
    "컨디션을 고려해 강도를 조절했습니다.",
    "루틴 유지에 방해 요소가 있었습니다.",
    "작은 습관을 꾸준히 이어갔습니다.",
  ],
  study: [
    "집중이 잘 되는 시간대를 활용했습니다.",
    "복습 시간을 충분히 확보했습니다.",
    "목표 대비 진행이 느렸습니다.",
  ],
  shopping: [
    "비교 후 구매했지만 기대와 달랐습니다.",
    "필요성보다 감정이 앞섰습니다.",
    "리뷰를 참고해 선택했습니다.",
  ],
  career: [
    "우선순위를 재정렬해 결정했습니다.",
    "피드백을 반영해 개선했습니다.",
    "협업 과정에서 변수가 생겼습니다.",
  ],
  daily: [
    "일정을 정리해 여유를 만들었습니다.",
    "예상치 못한 변수가 있었습니다.",
    "기록을 통해 흐름을 점검했습니다.",
  ],
  relationship: [
    "상대의 관점을 듣고 조율했습니다.",
    "감정적으로 반응해 아쉬웠습니다.",
    "대화를 통해 오해를 풀었습니다.",
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeTags(tags, count) {
  const shuffled = [...tags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const FIXED_NOW = new Date("2026-01-19T12:00:00.000Z");

function daysAgo(n) {
  const d = new Date(FIXED_NOW.getTime());
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAfter(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function pickRecentOffset() {
  return weightedPick([
    { value: randomBetween(0, 2), weight: 45 },
    { value: randomBetween(3, 6), weight: 35 },
    { value: randomBetween(7, 14), weight: 15 },
    { value: randomBetween(15, 28), weight: 5 },
  ]);
}

async function main() {
  const email = "lordangel82@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }

  await prisma.decision.deleteMany({
    where: {
      userId: user.id,
      title: { startsWith: TITLE_PREFIX },
    },
  });

  const data = [];
  const resultWeightsByCategory = {
    invest: [
      { value: "positive", weight: 45 },
      { value: "neutral", weight: 25 },
      { value: "negative", weight: 30 },
    ],
    health: [
      { value: "positive", weight: 55 },
      { value: "neutral", weight: 25 },
      { value: "negative", weight: 20 },
    ],
    study: [
      { value: "positive", weight: 50 },
      { value: "neutral", weight: 30 },
      { value: "negative", weight: 20 },
    ],
    shopping: [
      { value: "positive", weight: 40 },
      { value: "neutral", weight: 25 },
      { value: "negative", weight: 35 },
    ],
    career: [
      { value: "positive", weight: 45 },
      { value: "neutral", weight: 35 },
      { value: "negative", weight: 20 },
    ],
    daily: [
      { value: "positive", weight: 50 },
      { value: "neutral", weight: 30 },
      { value: "negative", weight: 20 },
    ],
    relationship: [
      { value: "positive", weight: 45 },
      { value: "neutral", weight: 30 },
      { value: "negative", weight: 25 },
    ],
  };

  CATEGORY_IDS.forEach((categoryId, idx) => {
    const resultWeights = resultWeightsByCategory[categoryId];
    const baseOffsets = [0, 1, 2, 3, 4].map(
      (n) => n + pickRecentOffset()
    );
    for (let i = 0; i < 5; i += 1) {
      const completed = i < 3;
      const createdAt = daysAgo(baseOffsets[i] + idx);
      createdAt.setHours(randomBetween(7, 22), randomBetween(0, 59), 0, 0);
      const resolvedAt = completed
        ? hoursAfter(createdAt, randomBetween(2, 48))
        : undefined;
      const result = completed ? weightedPick(resultWeights) : "pending";

      data.push({
        userId: user.id,
        categoryId,
        title: `${TITLE_PREFIX} - ${categoryId} ${i + 1}`,
        notes: pick(NOTES_BY_CATEGORY[categoryId]),
        tags: makeTags(TAGS_BY_CATEGORY[categoryId], 2 + (i % 2)),
        confidence: completed ? randomBetween(2, 5) : randomBetween(2, 4),
        result,
        meta: completed
          ? Math.random() > 0.25
            ? {
                reflection: "테스트 회고입니다.",
                reflectionPrompt: "판단의 근거는 충분했나?",
              }
            : undefined
          : undefined,
        createdAt,
        resolvedAt,
      });
    }
  });

  await prisma.decision.createMany({ data });
  console.log(`Inserted ${data.length} decisions for ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
