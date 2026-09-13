import { Star } from "lucide-react";

interface RatingStarsProps {
  average: number;
  count: number;
}

/**
 * Shared star-rating display extracted from `PopularStorage.tsx`'s original
 * inline pattern. Filled-star count is `Math.round(average)`; a room with no
 * ratings (`average: 0, count: 0`) renders 0 filled stars and `(0)` — this is
 * the backend's always-present default, not a missing-data case, so no
 * separate "sin calificaciones" string is introduced.
 */
const RatingStars: React.FC<RatingStarsProps> = ({ average, count }) => {
  return (
    <div className="flex items-center text-sm text-gray-600">
      <div className="flex items-center text-[#FFA500]">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < Math.round(average) ? "fill-current" : ""}`}
          />
        ))}
      </div>
      <span className="ml-2 text-gray-500">({count})</span>
    </div>
  );
};

export default RatingStars;
