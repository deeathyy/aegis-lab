import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  ExternalLink,
  Eye,
  GraduationCap,
  Map,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { dotaApi } from './api';

type Category = 'Все' | 'Основы' | 'Роли' | 'Карта' | 'Механики' | 'Экономика' | 'Драфт';

type Article = {
  id: string;
  category: Exclude<Category, 'Все'>;
  title: string;
  summary: string;
  level: 'База' | 'Средний' | 'Продвинутый';
  minutes: number;
  accent: 'cyan' | 'green' | 'orange' | 'blue';
  icon: typeof Target;
  keyIdea: string;
  sections: Array<{ title: string; body: string; bullets: string[] }>;
};

const CATEGORIES: Category[] = ['Все', 'Основы', 'Роли', 'Карта', 'Механики', 'Экономика', 'Драфт'];

const ARTICLES: Article[] = [
  {
    id: 'match-plan',
    category: 'Основы',
    title: 'Как читать матч по стадиям',
    summary: 'План на линию, середину и позднюю игру без привязки к конкретному патчу.',
    level: 'База',
    minutes: 6,
    accent: 'cyan',
    icon: Target,
    keyIdea: 'Сильная игра — это не набор случайных действий, а переход от ближайшей безопасной цели к следующей.',
    sections: [
      {
        title: 'Линия: создать ресурс',
        body: 'В начале матча ваша задача — превратить здоровье, ману и время в золото и опыт. Любой размен оценивается по тому, помогает ли он получить следующую волну или мешает сопернику.',
        bullets: ['Не пропускайте волну ради сомнительной погони.', 'Сверяйте действия с таймингом курьера и расходников.', 'Перед уходом с линии приведите волну в удобное положение.'],
      },
      {
        title: 'Середина: превратить силу в карту',
        body: 'После первых ключевых предметов команда должна забирать пространство: вышки, вражеский лес, обзор и безопасные линии фарма.',
        bullets: ['Играйте вокруг самого сильного героя команды.', 'После победы в драке заберите объект, а не ищите ещё одну драку.', 'Толкайте линии до выхода в туман — так противник вынужден показываться.'],
      },
      {
        title: 'Поздняя игра: снизить риск',
        body: 'Цена одной ошибки растёт. Перед выходом на высокую землю проверьте выкуп, обзор, ключевые способности и положение боковых линий.',
        bullets: ['Не начинайте важную драку без главного источника урона.', 'Сохраняйте контроль для опасной цели, а не первой доступной.', 'После выкупа меняйте стиль: безопасный фарм становится важнее лишнего объекта.'],
      },
    ],
  },
  {
    id: 'positions',
    category: 'Роли',
    title: 'Позиции 1–5 и распределение ресурсов',
    summary: 'Кто получает безопасный фарм, кто создаёт темп и кто закрывает карту обзором.',
    level: 'База',
    minutes: 7,
    accent: 'blue',
    icon: Users,
    keyIdea: 'Номер позиции описывает приоритет ресурсов, а не жёсткий список обязанностей на весь матч.',
    sections: [
      {
        title: 'Позиции 1 и 2',
        body: 'Керри превращает безопасный фарм в позднюю силу. Мидер получает ранние уровни и чаще первым задаёт темп, но конкретная инициатива зависит от героев.',
        bullets: ['Позиция 1 бережёт пространство до ключевого тайминга.', 'Позиция 2 использует преимущество уровней для давления.', 'Оба героя заранее сообщают команде о готовности драться.'],
      },
      {
        title: 'Позиции 3 и 4',
        body: 'Оффлейнер меняет устройство драки за счёт аур, инициации или выживаемости. Четвёртая позиция соединяет линии и помогает создавать численное преимущество.',
        bullets: ['Оффлейнер первым занимает опасную область.', 'Четвёрка играет вокруг рун, телепортов и активных героев.', 'Инициатор не обязан прыгать первым, если нет продолжения.'],
      },
      {
        title: 'Позиция 5',
        body: 'Пятая позиция защищает экономику команды через линию, обзор и полезные предметы. Это роль управления информацией, а не герой без ресурсов.',
        bullets: ['Ставьте обзор под следующий объект, а не под уже закончившуюся драку.', 'Берегите телепорт для реакции на давление.', 'Покупайте предмет, который позволяет пережить первый контакт.'],
      },
    ],
  },
  {
    id: 'vision-map',
    category: 'Карта',
    title: 'Обзор, туман войны и безопасная территория',
    summary: 'Как читать отсутствующих героев и ставить варды под конкретную задачу.',
    level: 'Средний',
    minutes: 8,
    accent: 'green',
    icon: Eye,
    keyIdea: 'Хороший вард отвечает на вопрос команды: кто подходит, где начинается драка или какой путь можно безопасно занять.',
    sections: [
      {
        title: 'Информация без варда',
        body: 'Положение волн, использованные телепорты и недавно показавшиеся герои уже формируют карту вероятностей.',
        bullets: ['Если несколько линий пусты, соперники могут собираться в тумане.', 'Глубоко протолкнутая линия заранее показывает защитника.', 'Исчезновение инициатора важнее исчезновения героя без контроля.'],
      },
      {
        title: 'Функциональный обзор',
        body: 'Ставьте наблюдателей после определения следующего объекта. Один и тот же холм может быть отличным или бесполезным в зависимости от направления игры.',
        bullets: ['Защитный обзор показывает входы в ваш лес.', 'Атакующий обзор видит подходы к объекту и телепорты.', 'Нестандартный вард живёт дольше, если всё равно закрывает нужный маршрут.'],
      },
      {
        title: 'Игра против обзора',
        body: 'Девардинг безопасен только при контроле области. Если команда не видна, проверка очевидного холма может стать ловушкой.',
        bullets: ['Сначала протолкните ближайшую линию.', 'Попросите героя передней линии проверить опасную область.', 'Не показывайте всю команду сразу после установки глубокого варда.'],
      },
    ],
  },
  {
    id: 'control-survival',
    category: 'Механики',
    title: 'Контроль, развеивание, Break и иммунитеты',
    summary: 'Практическая схема выбора защиты и понимания того, что именно мешает герою.',
    level: 'Средний',
    minutes: 9,
    accent: 'orange',
    icon: ShieldCheck,
    keyIdea: 'Защитный предмет выбирают против причины смерти: магического урона, контроля, сайленса, физического фокуса или пассивной способности.',
    sections: [
      {
        title: 'Сначала назовите угрозу',
        body: 'Фраза «мне нужна защита» слишком общая. Посмотрите повтор смерти и определите момент, после которого герой перестал выполнять свою задачу.',
        bullets: ['Контроль мешает нажать способности или уйти.', 'Сайленс выключает заклинания, но не предметы.', 'Break временно отключает большинство пассивных способностей.'],
      },
      {
        title: 'Развеивание',
        body: 'Развеивание снимает только эффекты, которые допускают соответствующий тип dispel. Оно не равно неуязвимости и не удаляет любой отрицательный эффект.',
        bullets: ['Проверяйте, можно ли снять конкретный эффект.', 'Сильное развеивание встречается реже и снимает больше типов контроля.', 'Иногда правильнее переждать эффект, сохранив предмет для следующего контроля.'],
      },
      {
        title: 'Слои выживания',
        body: 'Надёжная защита сочетает позицию, информацию и предмет. Даже сильный защитный эффект не исправляет вход в драку без союзников.',
        bullets: ['Позиция предотвращает урон.', 'Сопротивление и барьеры уменьшают полученный урон.', 'Мобильность разрывает дистанцию или меняет цель противника.'],
      },
    ],
  },
  {
    id: 'economy',
    category: 'Экономика',
    title: 'Экономика: опасный и безопасный фарм',
    summary: 'Как делить карту, не отбирать ресурсы у своего плана и сохранять выкуп.',
    level: 'Средний',
    minutes: 7,
    accent: 'green',
    icon: Coins,
    keyIdea: 'Ценность фарма определяется не только золотом, но и тем, какую часть карты он освобождает или ставит под угрозу.',
    sections: [
      {
        title: 'Безопасный ресурс',
        body: 'Безопасная линия видна, прикрыта телепортами и находится рядом с союзными объектами. Обычно её получает герой, которому важнее всего закончить предмет.',
        bullets: ['Не дублируйте фарм одного лагеря двумя героями.', 'Показывайтесь на линии минимально необходимое время.', 'Оставляйте ближайший безопасный ресурс герою без телепорта.'],
      },
      {
        title: 'Опасный ресурс',
        body: 'Опасную волну принимает мобильный, живучий или готовый пожертвовать собой герой. Его задача — получить информацию и заставить соперника реагировать.',
        bullets: ['Перед выходом оцените, кто из врагов не виден.', 'Заранее выберите путь отхода.', 'После реакции соперника команда должна использовать свободную область карты.'],
      },
      {
        title: 'Выкуп как предмет',
        body: 'В поздней игре запас на выкуп может быть сильнее ещё одного компонента. Решение зависит от длительности смерти и способности быстро вернуться в драку.',
        bullets: ['Проверяйте не только золото, но и доступность выкупа.', 'Не тратьте выкуп ради драки без важного объекта.', 'После выкупа сообщите команде, что следующая смерть критична.'],
      },
    ],
  },
  {
    id: 'draft',
    category: 'Драфт',
    title: 'Как найти условие победы драфта',
    summary: 'Не список контрпиков, а способ понять темп, цели и удобный тип драки.',
    level: 'Продвинутый',
    minutes: 10,
    accent: 'blue',
    icon: Swords,
    keyIdea: 'Драфт выигрывает не на экране выбора: он задаёт условия, при которых команде проще принимать правильные драки.',
    sections: [
      {
        title: 'Три вопроса до старта',
        body: 'Определите, кто начинает драку, кто наносит устойчивый урон и кто ломает здания. Если одной функции нет, её приходится компенсировать предметами или стилем игры.',
        bullets: ['Кто безопасно показывает линию?', 'Как команда ловит мобильную цель?', 'Что заставляет соперника прийти к вам?'],
      },
      {
        title: 'Темп силы',
        body: 'Одни составы сильны после первых недорогих предметов, другим нужны уровни и несколько слотов. Сравните эти окна, чтобы понимать, когда избегать или искать контакт.',
        bullets: ['Ранний состав меняет преимущество в объекты.', 'Поздний состав защищает линии и сокращает число рискованных драк.', 'Если тайминги совпали, преимущество дают обзор и инициатива.'],
      },
      {
        title: 'Форма удобной драки',
        body: 'Композиция может предпочитать узкий проход, растянутую погоню, быстрый взрыв одной цели или долгий бой. Выбирайте место, которое усиливает ваши способности.',
        bullets: ['Не заходите в узкий проход против массового контроля.', 'Растягивайте драку, если у вас лучше мобильность.', 'Защищайте героя, который обеспечивает повторяемый урон.'],
      },
    ],
  },
];

const GLOSSARY = [
  ['Break', 'Отключение большинства пассивных способностей.'],
  ['Dispel', 'Снятие эффектов, которые допускают соответствующий тип развеивания.'],
  ['Leash', 'Ограничение некоторых перемещающих способностей.'],
  ['Root', 'Запрет обычного движения и части мобильных действий.'],
  ['Silence', 'Запрет использования заклинаний.'],
  ['True Sight', 'Обнаружение невидимых существ и объектов.'],
  ['High ground', 'Область высоты с преимуществом обзора и правилами промахов.'],
  ['Tempo', 'Период, когда текущие уровни и предметы дают заметное преимущество.'],
];

export default function KnowledgeBasePage({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [category, setCategory] = useState<Category>('Все');
  const [selectedId, setSelectedId] = useState(ARTICLES[0].id);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    return ARTICLES.filter((article) => {
      const inCategory = category === 'Все' || article.category === category;
      const sectionText = article.sections
        .map((section) => `${section.title} ${section.body} ${section.bullets.join(' ')}`)
        .join(' ');
      const haystack = `${article.title} ${article.summary} ${article.category} ${article.keyIdea} ${sectionText}`.toLocaleLowerCase('ru');
      return inCategory && (!normalized || haystack.includes(normalized));
    });
  }, [category, query]);

  useEffect(() => {
    if (filtered.length && !filtered.some((article) => article.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = ARTICLES.find((article) => article.id === selectedId) || filtered[0] || ARTICLES[0];
  const SelectedIcon = selected.icon;

  return (
    <main className="knowledge-page">
      <section className="knowledge-hero">
        <div className="knowledge-hero-copy">
          <span className="eyebrow"><GraduationCap size={14} /> AEGIS ACADEMY</span>
          <h1>База знаний Dota 2</h1>
          <p>Короткие практические материалы, которые объясняют решения в матче — от распределения ресурсов до формы командной драки.</p>
          <div className="knowledge-stats">
            <span><b>{ARTICLES.length}</b> модулей</span>
            <span><b>{GLOSSARY.length}</b> терминов</span>
            <span><b>3</b> уровня сложности</span>
          </div>
        </div>
        <div className="knowledge-orbit" aria-hidden="true">
          <span><BookOpenCheck size={38} /></span>
          <i className="orbit-one"><Map size={16} /></i>
          <i className="orbit-two"><Zap size={16} /></i>
          <i className="orbit-three"><Coins size={16} /></i>
        </div>
      </section>

      <section className="knowledge-workspace">
        <aside className="knowledge-sidebar">
          <div className="knowledge-categories">
            {CATEGORIES.map((item) => (
              <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
                {item}<span>{item === 'Все' ? ARTICLES.length : ARTICLES.filter((article) => article.category === item).length}</span>
              </button>
            ))}
          </div>

          <div className="knowledge-list">
            <span className="knowledge-list-caption">{filtered.length ? `Материалы · ${filtered.length}` : 'Ничего не найдено'}</span>
            {query && <button className="knowledge-clear-search" onClick={() => onQueryChange('')}>Сбросить поиск</button>}
            {filtered.map((article) => {
              const Icon = article.icon;
              return (
                <button key={article.id} className={selected.id === article.id ? 'active' : ''} onClick={() => setSelectedId(article.id)}>
                  <span className={`knowledge-list-icon tone-${article.accent}`}><Icon size={16} /></span>
                  <span><strong>{article.title}</strong><small>{article.category} · {article.minutes} мин</small></span>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
        </aside>

        <article className="knowledge-article">
          <header className="knowledge-article-header">
            <div className={`knowledge-article-icon tone-${selected.accent}`}><SelectedIcon size={24} /></div>
            <div>
              <span>{selected.category} · {selected.level}</span>
              <h2>{selected.title}</h2>
              <p>{selected.summary}</p>
            </div>
            <span className="reading-time"><Clock3 size={13} /> {selected.minutes} минут</span>
          </header>

          <div className="knowledge-key-idea">
            <Sparkles size={17} />
            <span><b>Ключевая мысль</b>{selected.keyIdea}</span>
          </div>

          <div className="knowledge-sections">
            {selected.sections.map((section, index) => (
              <section key={section.title}>
                <div className="section-number">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}><CheckCircle2 size={14} /> <span>{bullet}</span></li>)}
                  </ul>
                </div>
              </section>
            ))}
          </div>

          <section className="knowledge-glossary">
            <div className="knowledge-block-heading">
              <span><BookOpenCheck size={17} /> Быстрый глоссарий</span>
              <small>Наведи курсор на термин</small>
            </div>
            <div>
              {GLOSSARY.map(([term, description]) => <span key={term} title={description}><b>{term}</b><small>{description}</small></span>)}
            </div>
          </section>

          <footer className="knowledge-sources">
            <div><ShieldCheck size={16} /><span><b>Проверяй детали патча</b><small>Числа и отдельные взаимодействия могут меняться после обновлений Dota 2.</small></span></div>
            <button onClick={() => dotaApi.openExternal('https://liquipedia.net/dota2game/Main_Page')}>Открыть Dota 2 Wiki <ExternalLink size={13} /></button>
          </footer>
        </article>
      </section>
    </main>
  );
}
