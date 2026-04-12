// FILE: client/src/components/RapportChat.tsx
// Chatbot widget voor de rapport-pagina
// Gebruikt de bestaande AIChatBox component

import { useState } from "react";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MessageCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface RapportChatProps {
  reportId: number;
  userName?: string;
  conditionType?: string;
}

const SUGGESTED_PROMPTS_BY_CONDITION: Record<string, string[]> = {
  chronic_fatigue: [
    "Waarom ben ik zo moe na lichte inspanning?",
    "Welk supplement helpt het meest bij mijn vermoeidheid?",
    "Hoe begin ik met het slaapprotocol?",
    "Wat is het verschil tussen magnesium glycinaat en malaat?",
  ],
  digestive_issues: [
    "Hoe werkt de 4R methode precies?",
    "Welke probiotica moet ik nemen?",
    "Wat mag ik eten in week 1?",
    "Waarom zijn gefermenteerde producten zo belangrijk?",
  ],
  solk: [
    "Hoe helpt ademhaling bij mijn klachten?",
    "Wat is graded activity precies?",
    "Hoe begin ik met de body scan meditatie?",
    "Waarom worden mijn klachten erger bij stress?",
  ],
  auto_immuun: [
    "Wat is het AIP dieet precies?",
    "Waarom is vitamine D zo belangrijk voor mij?",
    "Hoe herken ik histamine-intolerantie?",
    "Wat zijn de beste ontstekingsremmende voedingsmiddelen?",
  ],
  alk: [
    "Waar begin ik met het beweegplan?",
    "Welke supplementen helpen bij mijn pijn?",
    "Hoe pas ik mijn werkplek ergonomisch aan?",
    "Wat is het verschil tussen curcumine en ibuprofen?",
  ],
};

const DEFAULT_PROMPTS = [
  "Wat betekent dit supplement voor mij?",
  "Waar moet ik mee beginnen?",
  "Leg het protocol van maand 1 uit",
  "Hoe lang duurt herstel gemiddeld?",
];

export function RapportChat({ reportId, userName, conditionType }: RapportChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const chatMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.content },
      ]);
      setIsLoading(false);
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error(error.message || "Fout bij versturen bericht");
    },
  });

  const suggestedPrompts =
    (conditionType && SUGGESTED_PROMPTS_BY_CONDITION[conditionType]) ||
    DEFAULT_PROMPTS;

  function handleSendMessage(content: string) {
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    chatMutation.mutate({
      reportId,
      messages: newMessages.filter((m) => m.role !== "system"),
    });
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — klikbaar om te openen/sluiten */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <div className="font-bold text-gray-900 flex items-center gap-2">
              Stel een vraag over jouw rapport
              <span className="text-xs font-normal bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {messages.length === 0
                ? "Vraag alles over jouw persoonlijke analyse"
                : `${messages.filter((m) => m.role === "user").length} vragen gesteld`}
            </div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Chat box — alleen zichtbaar als open */}
      {isOpen && (
        <div className="border-t border-gray-100">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholder={`Stel een vraag over jouw rapport${userName ? `, ${userName.split(" ")[0]}` : ""}...`}
            height="480px"
            emptyStateMessage="Stel een vraag over jouw persoonlijke rapport"
            suggestedPrompts={suggestedPrompts}
            className="rounded-none border-0 shadow-none"
          />
        </div>
      )}
    </div>
  );
}
