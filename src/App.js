import { useState } from 'react';
import Home from './Home';
import Details from './Details';
import SubmissionForm from './SubmissionForm';

function App() {
  const [page, setPage] = useState('home');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);

  const handleViewDetails = (opportunity) => {
    setSelectedOpportunity(opportunity || null);
    setPage('details');
  };

  if (page === 'details') {
    return (
      <Details
        opportunity={selectedOpportunity}
        opportunityId={selectedOpportunity?.id || null}
        onBack={() => setPage('home')}
        onPostOpportunity={() => setPage('submission')}
        onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
      />
    );
  }

  if (page === 'submission') {
    return <SubmissionForm />;
  }

  return (
    <Home
      onViewDetails={handleViewDetails}
      onPostOpportunity={() => setPage('submission')}
    />
  );
}

export default App;
