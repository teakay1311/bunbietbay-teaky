import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function LinkifyText({ text, className = '' }: { text?: string, className?: string }) {
    if (!text) return null;

    const parts = text.split(URL_REGEX);

    return (
        <span className={className}>
            {parts.map((part, i) => {
                if (part.match(URL_REGEX)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium break-all underline-offset-2"
                            onClick={(e) => e.stopPropagation()} // in case it's inside a clickable card
                        >
                            {part}
                        </a>
                    );
                }
                // Handle newlines as <br /> to preserve formatting
                return part.split('\n').map((line, j, arr) => (
                    <React.Fragment key={`${i}-${j}`}>
                        {line}
                        {j < arr.length - 1 && <br />}
                    </React.Fragment>
                ));
            })}
        </span>
    );
}
