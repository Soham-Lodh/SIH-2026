import React from 'react';
import { Users, Code2 } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  photo: string;
  location: string;
  bio: string;
  isLead: boolean;
}

export const TeamPage: React.FC = () => {
  const teamMembers: TeamMember[] = [
    {
      name: 'Soham Lodh',
      role: 'Machine Learning & Full-Stack Developer',
      photo: 'https://res.cloudinary.com/lugbjbva/image/upload/v1787859541/suited.png',
      location: 'Kolkata, West Bengal',
      bio: 'Specializes in predictive hazard simulation models, USGS earthquake ingestions, and multi-language profanity moderations.',
      isLead: true,
    },
    {
      name: 'Dhrupad Paitandy',
      role: 'Machine Learning & Full-Stack Developer',
      photo: 'https://res.cloudinary.com/ub4y3cag/image/upload/v1787888668/WhatsApp_Image_2026-08-28_at_1.14.03_AM.jpg',
      location: 'Bolpur, West Bengal',
      bio: 'Specializes in predictive hazard simulation models, USGS earthquake ingestions, and multi-language profanity moderations.',
      isLead: false,
    },
    {
      name: 'Aditya Arpit',
      role: 'Full-Stack Developer',
      photo: 'https://res.cloudinary.com/lugbjbva/image/upload/v1787859397/photo.png',
      location: 'Durgapur, West Bengal',
      bio: 'Directs platform architecture, geospatial relevance engines, translation systems, and multi-workspace integrations.',
      isLead: false,
    },
    {
      name: 'Aprajita Kumari',
      role: 'UI/UX & Frontend Engineer',
      photo: 'https://res.cloudinary.com/ub4y3cag/image/upload/v1787889486/f4a9f840-4375-4a51-bdb9-8abdce717627.jpg ',
      location: 'Bhagalpur, Bihar',
      bio: 'Crafts responsive Figma-faithful UI interfaces, custom Leaflet styling layers, and animation transitions.',
      isLead: false,
    },
    {
      name: 'Garima Kriti',
      role: 'Machine Learning Engineer',
      photo: 'https://res.cloudinary.com/ub4y3cag/image/upload/v1787888706/3b628aaf-4303-4568-8b7a-eb281efa5692.jpg',
      location: 'Kolkata, West Bengal',
      bio: 'Crafts responsive Figma-faithful UI interfaces, custom Leaflet styling layers, and animation transitions.',
      isLead: false,
    },
    {
      name: 'Aaryav Sharma',
      role: 'Machine Learning Engineer',
      photo: 'https://res.cloudinary.com/lugbjbva/image/upload/v1787931004/WhatsApp_Image_2026-08-28_at_8.57.47_PM.jpg',
      location: 'Kolkata, West Bengal',
      bio: 'Specializes in predictive hazard simulation models, USGS earthquake ingestions, and multi-language profanity moderations.',
      isLead: false,
    },
  ];

  const techStack = [
    { category: 'Core Frontend', items: ['React 19', 'TypeScript', 'Vite', 'Tailwind CSS v4', 'Motion'] },
    { category: 'Geospatial', items: ['Leaflet Map Engine', 'GeoJSON Geometry', 'Haversine Relevance'] },
    { category: 'Server Backend', items: ['Node.js', 'Express.js', 'fast-xml-parser', 'multer'] },
    { category: 'Intelligence', items: ['Groq Llama LLM', 'Groq Whisper Speech-to-Text', 'Groq Text-to-Speech'] },
    { category: 'Localization', items: ['MyMemory translation API', '22 Constitutional Indian Languages'] },
  ];

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#ECF8F8] text-[#0F1B29] font-sans px-4 sm:px-6 lg:px-8 py-8 select-none">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header Section */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#DDDDDD]/60 border border-[#DDDDDD] text-[#0F1B29] text-xs font-bold uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            <span>Development Team</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F1B29] tracking-tight">
            Meet the Builders of AapdaDrishti
          </h1>
          <p className="text-sm text-[#747F8D] max-w-lg mx-auto">
            Combining machine learning, geospatial analysis, and localized web access into India's premier disaster intelligence platform.
          </p>
        </div>

        {/* Dual Column Layout: Members Card List & Tech Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Columns - Team Members Cards */}
          <div className="lg:col-span-2 space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className={`bg-white rounded-2xl border border-[#DDDDDD] p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 shadow-xs transition-all duration-300 hover:shadow-md hover:border-[#747F8D]/50 ${
                  member.isLead ? 'ring-2 ring-[#0F1B29] ring-offset-2 ring-offset-[#ECF8F8]' : ''
                }`}
              >
                {/* Photo */}
                <div className="relative shrink-0">
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[#DDDDDD]"
                  />
                  {member.isLead && (
                    <span className="absolute -bottom-2 -right-2 bg-[#0F1B29] text-white text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-white">
                      Lead
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F1B29] flex items-center justify-center sm:justify-start gap-2">
                      <span>{member.name}</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-[#ECF8F8] border border-[#DDDDDD] text-[#747F8D]">
                        {member.location}
                      </span>
                    </h3>
                    <p className="text-xs font-bold text-[#747F8D] uppercase tracking-wide mt-0.5">{member.role}</p>
                  </div>
                  <p className="text-xs text-[#747F8D] leading-relaxed">
                    {member.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - Tech Stack */}
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Tech Stack Card */}
            <div className="bg-white border border-[#DDDDDD] rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-[#0F1B29] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#DDDDDD]/40 pb-2">
                <Code2 className="w-4 h-4 text-[#747F8D]" />
                <span>Technology Stack</span>
              </h3>
              <div className="space-y-3">
                {techStack.map((stack) => (
                  <div key={stack.category} className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#747F8D] tracking-wider">{stack.category}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {stack.items.map((item) => (
                        <span key={item} className="text-[10px] px-2 py-1 rounded bg-[#ECF8F8] border border-[#DDDDDD]/60 text-[#0F1B29] font-semibold">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TeamPage;
