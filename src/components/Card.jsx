// src/components/Card.jsx


const Card = ({ children, className = '', hover = false }) => {
  return (
    <div className={`
      bg-white rounded-xl shadow-sm border border-gray-100 p-6
      ${hover ? 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

export default Card;