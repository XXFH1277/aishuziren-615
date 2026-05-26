export default function PageHeader({ title, description, extra }) {
  return (
    <section className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {extra ? <div>{extra}</div> : null}
    </section>
  );
}
