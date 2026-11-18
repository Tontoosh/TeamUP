import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { date, post } from '../api';
import { useApi } from '../hooks';
import { useApp } from '../context';
import type { PeerReview, Reputation } from '../types';
import { Empty, ErrorState, Loading } from './ui';
import { RatingSummary } from './MatchSummary';

interface ReviewsData {
  items: PeerReview[]; total: number; reputation: Reputation;
  eligibleProjects: { id: string; name: string }[];
}
const dimensions = [['quality', 'Ажлын чанар'], ['reliability', 'Хугацаа, хариуцлага'], ['communication', 'Харилцаа, хамтын ажиллагаа']] as const;

export function ProfileReviews({ userId, own }: { userId: string; own: boolean }) {
  const { data, loading, error, reload } = useApi<ReviewsData>(`/reviews/${userId}`);
  const { toast } = useApp();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setFormError('');
    try {
      await post('/reviews', { ...form, target_id: userId,
        quality: Number(form.quality), reliability: Number(form.reliability), communication: Number(form.communication) });
      toast('Хамтын ажиллагааны үнэлгээ хадгалагдлаа.');
      await reload();
    } catch (err) { setFormError((err as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section className="panel profile-reviews">
      <h2>Хамтын ажиллагааны үнэлгээ</h2>
      {loading ? <Loading /> : error ? <ErrorState message={error} retry={reload} /> : data && <>
        <RatingSummary reputation={data.reputation} />
        {data.reputation.count > 0 && <>
          <dl className="review-dimensions">{dimensions.map(([key, label]) => <div key={key}>
            <dt>{label}</dt><dd>{data.reputation.dimensions[key]} / 5</dd>
          </div>)}</dl>
          <p className="helper">Тохирлын оноонд үнэлгээний тоог харгалзсан {data.reputation.adjusted.toFixed(2)} / 5 үнэлгээг ашиглана.
            Нэг гишүүний давтан үнэлгээг нэг эх сурвалж гэж тооцно.</p>
        </>}
        {data.eligibleProjects.length > 0 && <form className="form-stack review-form" onSubmit={submit}>
          <h3>Хамт ажилласан туршлагаа үнэлээрэй</h3>
          <label>Хамтарсан төсөл
            <select name="project_id" required defaultValue={data.eligibleProjects.some(p => p.id === params.get('reviewProject'))
              ? params.get('reviewProject')! : data.eligibleProjects[0].id}>
              {data.eligibleProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <div className="review-rating-inputs">{dimensions.map(([key, label]) => <label key={key}>{label}
            <select name={key} required defaultValue=""><option value="" disabled>Үнэлгээ сонгох</option>
              {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}
            </select>
          </label>)}</div>
          <label>Сэтгэгдэл
            <textarea name="comment" required minLength={10} maxLength={2000} rows={3}
              placeholder="Хамтран хийсэн ажил, давуу тал, сайжруулах зүйлийг бодит жишээгээр бичээрэй." />
          </label>
          <small className="helper">Төсөл бүрд нэг удаа өгнө. Нийтэлсэн үнэлгээг засахгүй тул илгээхээсээ өмнө шалгаарай.</small>
          {formError && <ErrorState message={formError} />}
          <button className="btn primary" disabled={busy}>{busy ? 'Хадгалж байна…' : 'Үнэлгээ нийтлэх'}</button>
        </form>}
        {!own && !data.eligibleProjects.length && <p className="helper">Ажил дууссан төслийн багийн гишүүд бие биедээ төсөл бүрд нэг удаа үнэлгээ өгнө.</p>}
        {data.items.length ? <div className="review-list">{data.items.map(review => <article key={review.id}>
          <div className="space-between"><Link to={`/people/${review.author_id}`}>{review.author_name}</Link><small>{date(review.created_at)}</small></div>
          <p className="muted"><Link to={`/projects/${review.project_id}`}>{review.project_name}</Link> · {review.target_role}</p>
          <div className="tags">{dimensions.map(([key, label]) => <span key={key}>{label} {review[key]}/5</span>)}</div>
          <p className="preserve-text">{review.comment}</p>
        </article>)}</div> : <Empty title="Үнэлгээ хараахан байхгүй" text="Үнэлгээ байхгүй хэрэглэгчийг тохирлын эрэмбээс хасахгүй." />}
        {data.total > data.items.length && <p className="helper">Нийт {data.total} үнэлгээнээс сүүлийн {data.items.length}-г харуулж байна.</p>}
      </>}
    </section>
  );
}
