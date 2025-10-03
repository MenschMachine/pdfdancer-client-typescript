import React from 'react';
import Link from '@docusaurus/Link';

export default function Home(): JSX.Element {
  return (
    <main style={{maxWidth: 900, margin: '48px auto', padding: '0 16px'}}>
      <h1 style={{marginTop: 0}}>pdfdancer TypeScript Client</h1>
      <p>Browse the docs and API reference:</p>
      <ul>
        <li><Link to="/docs/overview">Overview</Link></li>
        <li><Link to="/docs/quickstart">Quickstart</Link></li>
        <li><Link to="/docs/api">API Reference</Link></li>
      </ul>
      <p style={{color:'#6b7280'}}>This is a prototype. Content is placeholder.</p>
    </main>
  );
}
