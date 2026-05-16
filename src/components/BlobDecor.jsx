export function BlobDecor({ className = '' }) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute pointer-events-none select-none ${className}`}
      aria-hidden
    >
      <path
        d="M231.5,300Q189,400,102.5,357.5Q16,315,17.5,207.5Q19,100,112,54Q205,8,262.5,79Q320,150,300,225Q280,300,231.5,300Z"
        fill="#7EC8A4"
        fillOpacity="0.18"
      />
    </svg>
  )
}
