'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main style={{padding:40}}><h1>Something went wrong.</h1><p>Please try again. If this continues, check the local server terminal.</p><button className="button" onClick={reset}>Try again</button></main>}
