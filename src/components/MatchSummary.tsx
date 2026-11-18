import { Link } from 'react-router-dom';
import type { Match, Reputation } from '../types';

export function RatingSummary({ reputation }: { reputation?: Reputation }) {
  return <p className="rating-summary">{reputation?.count
    ? `★ ${reputation.average?.toFixed(1)} / 5 · ${reputation.reviewers} гишүүн · ${reputation.count} үнэлгээ`
    : 'Хамтын ажиллагааны үнэлгээ хараахан байхгүй'}</p>;
}

export function MatchSummary({ match }: { match?: Match }) {
  if (!match) return null;
  const rows = [
    ['skills', 'Ур чадвар', 60], ['availability', 'Боломжит цаг', 20],
    ['interest', 'Сонирхол', 10], ['reputation', 'Хамтын ажиллагааны үнэлгээ', 10],
  ] as const;
  return (
    <div className="match-summary">
      <div className="space-between"><b>Тохирлын оноо</b><strong>{match.score} / 100</strong></div>
      <p><Link to={`/projects/${match.projectId}`}>{match.projectName}</Link> · {match.role}</p>
      <details>
        <summary>Яагаад санал болгосон бэ?</summary>
        <dl className="score-breakdown">{rows.map(([key, label, maximum]) => (
          <div key={key}><dt>{label}</dt><dd>{match.breakdown[key]} / {maximum}</dd></div>
        ))}</dl>
        <ul>{match.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        {match.ungradedSkills > 0 && <p>Зарим ур чадварын түвшин тодорхойгүй тул нийцлийг хэсэгчлэн тооцсон.</p>}
        <small>Энэ нь эрэмбэлэх оноо бөгөөд амжилттай хамтрах магадлал биш.</small>
      </details>
    </div>
  );
}
