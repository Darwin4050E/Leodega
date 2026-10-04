import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RatingStars from './RatingStars';

describe('RatingStars', () => {
  it('renders 4 filled stars and 1 empty star for a 4.2 average, with the count beside them', () => {
    const { container } = render(<RatingStars average={4.2} count={8} />);

    const filledStars = container.querySelectorAll('.fill-current');
    expect(filledStars).toHaveLength(4);
    expect(screen.getByText('(8)')).toBeInTheDocument();
  });

  it('renders 0 filled stars and (0) for a zero-rating room', () => {
    const { container } = render(<RatingStars average={0} count={0} />);

    const filledStars = container.querySelectorAll('.fill-current');
    expect(filledStars).toHaveLength(0);
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });
});
