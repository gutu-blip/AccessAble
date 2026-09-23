import { render, screen } from '@testing-library/react';
import App from './App';

test('renders submission form heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/post an inclusive opportunity/i);
  expect(headingElement).toBeInTheDocument();
});
