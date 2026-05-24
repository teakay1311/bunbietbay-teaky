import { useState } from 'react';
import { Icons } from './Icons';

export function StarRatingInput({ name, defaultValue = 5 }: { name: string, defaultValue?: number }) {
    const [rating, setRating] = useState(defaultValue);

    return (
        <div className="flex items-center gap-0.5 flex-wrap">
            <input type="hidden" name={name} value={rating} />
            {Array.from({ length: 5 }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1)}
                    className="p-0.5 focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    title={`${i + 1} sao`}
                >
                    <Icons.Star
                        className={`w-7 h-7 transition-colors ${i < rating ? 'fill-amber-500 text-amber-500' : 'text-outline-variant'} ${i < rating ? '' : 'fill-none'}`}
                    />
                </button>
            ))}
        </div>
    );
}
