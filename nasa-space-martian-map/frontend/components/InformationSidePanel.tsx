import React, { useState } from 'react';
import {
  Info,
  X,
  Search,
  Users,
  FlaskConical,
  Bot,
  Droplets,
  AlertTriangle,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Radio,
  Activity,
  Layers,
  Sparkles,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { DetectedObject, ObjectCategory } from '../types';
import type { Site } from '../lib/missionTypes';
import { hudSound } from '../utils/soundEffects';

interface InformationSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  objects: DetectedObject[];
  sites?: Site[];
  selectedObjectId: string | null;
  onSelectObject: (obj: DetectedObject) => void;
  onSetNavigationTarget: (obj: DetectedObject) => void;
}

export const InformationSidePanel: React.FC<InformationSidePanelProps> = ({
  isOpen,
  onClose,
  objects,
  sites = [],
  selectedObjectId,
  onSelectObject,
  onSetNavigationTarget,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | ObjectCategory>('SCIENCE');
  const [selectedUnplottedId, setSelectedUnplottedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanTitle = (t: string) => t.replace(/\s*\(measured DEM\)/gi, '').trim();
  const unplottedSites = sites.filter((s) => s.lat == null || s.lon == null);

  // Find currently inspected object or unplotted site
  const unplottedSelected = selectedUnplottedId
    ? unplottedSites.find((s) => s.id === selectedUnplottedId) ?? null
    : null;
  const currentObject = !unplottedSelected
    ? objects.find((o) => o.id === selectedObjectId) || objects[0] || null
    : null;

  const filteredUnplotted =
    activeCategory === 'ALL' || activeCategory === 'SCIENCE'
      ? unplottedSites.filter(
          (s) =>
            searchQuery === '' ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : [];

  // Filter objects based on search query and category
  const filteredObjects = objects.filter((obj) => {
    const matchesCategory =
      activeCategory === 'ALL' || obj.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      cleanTitle(obj.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.details.some(
        (d) =>
          d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.value.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: ObjectCategory) => {
    switch (category) {
      case 'CREW':
        return <Users className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ROVER':
        return <Bot className="w-3.5 h-3.5 text-sky-400" />;
      case 'RESOURCE':
        return <Droplets className="w-3.5 h-3.5 text-[#ff8a8e]" />;
      case 'HAZARD':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'SCIENCE':
      default:
        return <FlaskConical className="w-3.5 h-3.5 text-[#E5484D]" />;
    }
  };

  const getCategoryBadgeClass = (category: ObjectCategory) => {
    switch (category) {
      case 'CREW':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
      case 'ROVER':
        return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
      case 'RESOURCE':
        return 'bg-[#E5484D]/15 text-[#ff8a8e] border-[#E5484D]/35';
      case 'HAZARD':
        return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
      case 'SCIENCE':
      default:
        return 'bg-[#E5484D]/15 text-[#ff8a8e] border-[#E5484D]/35';
    }
  };

  const categories: { key: 'ALL' | ObjectCategory; label: string; count: number }[] = [
    { key: 'SCIENCE', label: 'SITES', count: sites.length > 0 ? sites.length : objects.filter((o) => o.category === 'SCIENCE').length },
    { key: 'ALL', label: 'ALL', count: objects.length + unplottedSites.length },
    {
      key: 'HAZARD',
      label: 'HAZARDS',
      count: objects.filter((o) => o.category === 'HAZARD').length,
    },
  ];

  return (
    <div
      id="hud-information-sidepanel"
      className="absolute top-0 right-0 bottom-0 z-50 w-full sm:w-[410px] md:w-[440px] pointer-events-auto select-none flex flex-col bg-slate-950/90 backdrop-blur-2xl border-l border-[#E5484D]/30 shadow-[-15px_0_45px_rgba(0,0,0,0.85)] text-white animate-slideInRight"
      style={{
        boxShadow: '-10px 0 35px -5px rgba(229, 72, 77, 0.15), -20px 0 60px rgba(0,0,0,0.9)',
      }}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E5484D]/20 border border-[#E5484D]/50 flex items-center justify-center text-[#ff8a8e] shadow-[0_0_12px_rgba(229,72,77,0.3)]">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold tracking-wider text-[#ff8a8e] uppercase">
                JEZERO SITES &amp; TERRAIN
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#E5484D]/20 text-rose-200 border border-[#E5484D]/35">
                {sites.length > 0 ? `${sites.length} SITES` : `${objects.length} TARGETS`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Live Expedition Telemetry & Scanned Entities
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            hudSound.playClick();
            onClose();
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
          title="Close Information Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="px-5 pt-3 pb-2 border-b border-white/10 space-y-2.5 bg-slate-950/40">
        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#E5484D]/80 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search targets, minerals, crew, instruments..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 focus:border-[#E5484D]/70 focus:outline-none text-xs text-white placeholder-slate-500 font-mono transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  hudSound.playClick();
                  setActiveCategory(cat.key);
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold tracking-wider transition-all whitespace-nowrap flex items-center space-x-1 border ${
                  isActive
                    ? 'bg-[#E5484D]/25 border-[#E5484D]/70 text-rose-200 shadow-[0_0_10px_rgba(229,72,77,0.3)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className="opacity-60 text-[9px]">({cat.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 3.1 Inspected Object Detailed Dossier Card */}
        {currentObject && (
          <div className="rounded-xl bg-slate-900/80 border border-[#E5484D]/50 p-4 shadow-lg space-y-3 relative overflow-hidden">
            {/* Top accent glow line */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#FF3B30] to-transparent" />

            {/* Category & Live Distance */}
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold tracking-wider ${getCategoryBadgeClass(
                  currentObject.category
                )}`}
              >
                {getCategoryIcon(currentObject.category)}
                <span>{currentObject.categoryLabel}</span>
              </div>

              <div className="flex items-center space-x-1 text-xs font-mono font-bold text-[#ff8a8e]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-ping mr-0.5" />
                <span>{Math.round(currentObject.distanceMeters)} METERS</span>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-1.5">
                <span>{currentObject.title}</span>
              </h3>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                {currentObject.subtitle}
              </p>
            </div>

            {/* NASA Mission Photo Preview (if available) */}
            {currentObject.image && (
              <div className="relative rounded-lg overflow-hidden border border-[#E5484D]/35 shadow-inner">
                <img
                  src={currentObject.image}
                  alt={currentObject.title}
                  className="w-full h-32 object-cover filter contrast-105"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-2">
                  <span className="text-[10px] text-[#ff8a8e] font-bold block truncate">
                    {currentObject.nasaMission || 'NASA SPECTRAL OPTICAL ARCHIVE'}
                  </span>
                </div>
              </div>
            )}

            {currentObject.nasaMission && !currentObject.image && (
              <div className="px-2.5 py-1 rounded-md bg-[#1a080a]/70 border border-[#E5484D]/30 text-[10px] font-mono text-[#ff8a8e]">
                <span className="opacity-70 mr-1.5">SOURCE:</span>
                <span className="font-semibold">{currentObject.nasaMission}</span>
              </div>
            )}

            {/* Technical Specifications & Telemetry Rows */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-mono tracking-wider text-white/50 uppercase pb-1 border-b border-white/10 flex items-center justify-between">
                <span>DETAILED TELEMETRY & SPECS</span>
                <span className="text-[#E5484D]">STATUS: NOMINAL</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs font-mono">
                {currentObject.details.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/5"
                  >
                    <span className="text-[11px] text-slate-400">{d.label}:</span>
                    <span className="text-[11px] font-semibold text-white text-right truncate ml-2">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={() => {
                  hudSound.playTargetLock();
                  onSetNavigationTarget(currentObject);
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-[#E5484D]/25 hover:bg-[#E5484D]/35 border border-[#E5484D]/60 text-white text-xs font-mono font-bold flex items-center justify-center space-x-1.5 shadow-[0_0_15px_rgba(229,72,77,0.25)] transition-all active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5 text-[#ff8a8e]" />
                <span>SET AS NAVIGATION TARGET</span>
              </button>
            </div>
          </div>
        )}

        {/* 3.1b Unplotted Site Detailed Dossier Card (location not published) */}
        {unplottedSelected && (
          <div className="rounded-xl bg-slate-900/80 border border-amber-400/40 p-4 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md border border-amber-400/30 bg-amber-500/15 text-[10px] font-mono font-bold text-amber-300">
                LOCATION NOT PUBLISHED
              </span>
              <span className="text-[10px] font-mono text-white/50">{unplottedSelected.mission}</span>
            </div>
            <h3 className="text-sm font-bold text-white">{unplottedSelected.name}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{unplottedSelected.description}</p>
            {unplottedSelected.chemistry && (
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/10 text-[11px] font-mono text-rose-200">
                Chemistry: {unplottedSelected.chemistry}
              </div>
            )}
            <div className="text-[11px] font-mono text-amber-200/80">
              Coordinates not yet published — readable here, not plottable on the route map.
            </div>
          </div>
        )}

        {/* 3.2 List of All Detected Objects & Unplotted Sites in Crater */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="uppercase tracking-wider">
              {activeCategory === 'SCIENCE' ? 'REAL JEZERO SITES' : 'ALL TARGETS'} ({filteredObjects.length + filteredUnplotted.length})
            </span>
            <span className="text-[10px] text-[#E5484D]">CLICK TO INSPECT</span>
          </div>

          <div className="space-y-1.5">
            {filteredObjects.map((obj) => {
              const isSelected = !unplottedSelected && obj.id === (currentObject?.id ?? '');
              const titleDisplay = cleanTitle(obj.title);
              return (
                <div
                  key={obj.id}
                  onClick={() => {
                    hudSound.playClick();
                    setSelectedUnplottedId(null);
                    onSelectObject(obj);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#1a080a]/70 border-[#FF3B30]/75 shadow-[0_0_15px_rgba(229,72,77,0.25)]'
                      : 'bg-slate-900/50 hover:bg-slate-900/80 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-white/10 shrink-0">
                      {getCategoryIcon(obj.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {titleDisplay}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded border shrink-0 ${getCategoryBadgeClass(
                            obj.category
                          )}`}
                        >
                          {obj.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {obj.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span className="text-xs font-mono font-bold text-[#ff8a8e]">
                      {Math.round(obj.distanceMeters)} m
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 flex items-center space-x-0.5 mt-0.5">
                      <span>INSPECT</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredUnplotted.map((s) => {
              const isSel = selectedUnplottedId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    hudSound.playClick();
                    setSelectedUnplottedId(s.id);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSel
                      ? 'bg-amber-950/40 border-amber-400/70'
                      : 'bg-slate-900/50 hover:bg-slate-900/80 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-amber-400/20 shrink-0">
                      <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white truncate block">{s.name}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded border border-amber-400/30 bg-amber-500/15 text-amber-300 shrink-0">
                          UNPLOTTED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        Location not published · {s.goal}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-amber-300/80 shrink-0">READ</span>
                </div>
              );
            })}

            {filteredObjects.length === 0 && filteredUnplotted.length === 0 && (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No sites matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Footer Status Bar */}
      <div className="px-5 py-2.5 border-t border-white/10 bg-slate-950 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>LIDAR + AR SENSORS ACTIVE</span>
        </div>
        <button
          onClick={() => {
            hudSound.playClick();
            onClose();
          }}
          className="text-[#E5484D] hover:text-[#ff8a8e] font-semibold"
        >
          DISMISS PANEL
        </button>
      </div>
    </div>
  );
};
