import { useState } from 'react';
import { HelpCircle, X, MessageCircle, AlertTriangle, Phone, Lock, Vote, Eye } from 'lucide-react';

const HELP_ITEMS = [
  {
    icon: Vote,
    question: 'How do I vote?',
    answer: 'Swipe left or right to see all the candidates for each position. Click on the candidate you want to vote for, then click "Confirm vote". You cannot change your vote after confirming, so choose carefully!',
  },
  {
    icon: Lock,
    question: 'Is my vote secret?',
    answer: 'Yes! Your vote is completely secret. Nobody can see who you voted for — not your classmates, not your lecturers, not even the admin.',
  },
  {
    icon: Eye,
    question: 'How do I see results?',
    answer: 'After the election closes, results will appear on your dashboard automatically. You will see who won each position and how many votes they got.',
  },
  {
    icon: AlertTriangle,
    question: 'I made a mistake. Can I change my vote?',
    answer: 'No. Once you confirm your vote for a position, it is final. This is to make sure the election is fair for everyone. Please choose carefully before confirming.',
  },
  {
    icon: Phone,
    question: 'I need more help. Who do I contact?',
    answer: 'If you are stuck or something is not working, contact your department admin or electoral committee. They can help you with any issues.',
  },
  {
    icon: MessageCircle,
    question: 'The page is not loading. What should I do?',
    answer: 'Check your internet connection first. If your internet is working, refresh the page. If it still does not work, wait a moment and try again. If the problem continues, contact your admin.',
  },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Help"
      >
        <HelpCircle className="w-7 h-7" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-extrabold text-gray-900">Help &amp; FAQ</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {HELP_ITEMS.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
                      <item.icon className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-gray-900 mb-1">{item.question}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 text-center">
              <p className="text-xs text-gray-500">Still need help? Contact your department admin or electoral committee.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
