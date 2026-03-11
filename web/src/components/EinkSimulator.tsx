'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Select from 'react-select';
import Icon from '@mdi/react';
import { mdiLightbulb, mdiFan, mdiToggleSwitchOutline, mdiMinusBox, mdiHomeAutomation } from '@mdi/js';

const IconPickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (val: string) => void }) => {
    const [query, setQuery] = useState('');
    const [icons, setIcons] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const fetchIcons = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/icons?q=${query}`);
                if (!res.ok) throw new Error(`API returned ${res.status}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setIcons(data);
                } else {
                    setIcons([]);
                }
            } catch (e) {
                console.error("Icon fetch failed:", e);
                setIcons([]);
            }
            setLoading(false);
        };
        const timer = setTimeout(fetchIcons, 300);
        return () => clearTimeout(timer);
    }, [query, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-4xl shadow-2xl flex flex-col gap-6 max-h-[85vh] animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-white">Choose MDI Icon</h3>
                        <p className="text-sm text-gray-400 mt-1">Search through 7,000+ icons. Try "robot", "sofa", or "blind".</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <input
                    type="text"
                    placeholder="Search icons..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-black border-2 border-gray-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-lg font-medium"
                    autoFocus
                />
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                            <span className="text-gray-500 font-medium">Searching icons...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {icons.map(icon => (
                                <button
                                    key={icon.value}
                                    onClick={() => onSelect(icon.value)}
                                    className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gray-800/50 border border-transparent hover:bg-gray-800 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all group"
                                >
                                    <svg viewBox="0 0 24 24" className="w-10 h-10 fill-gray-400 group-hover:fill-blue-400 group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-all duration-300">
                                        <path d={icon.path} />
                                    </svg>
                                    <span className="text-[10px] text-gray-500 group-hover:text-blue-300 text-center leading-tight line-clamp-2">{icon.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {!loading && icons.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            <span className="text-4xl mb-4 block">🔍</span>
                            No icons found for "{query}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// The display is 540x960, we scale it down for web UI (e.g. by 0.5)
const DISPLAY_WIDTH = 540;
const DISPLAY_HEIGHT = 960;
const SCALE = 0.5;

export type WidgetType = 'Slider' | 'Button';

export interface WidgetConfig {
    id: string; // Internal id for React map
    type: WidgetType;
    entity_id: string;
    label: string;
    icon_on: string;
    icon_off: string;
    pos_x: number;
    pos_y: number;
    width?: number; // Sliders
    height?: number; // Sliders
    command_type: string;
}

interface EinkSimulatorProps {
    widgets: WidgetConfig[];
    onWidgetsChange: (widgets: WidgetConfig[]) => void;
    entities?: { entity_id: string; friendly_name: string }[];
}

// Map command types to MDI paths for visual simulation
const getIconForWidget = (commandType: string) => {
    if (commandType.includes('Light')) return mdiLightbulb;
    if (commandType.includes('Fan')) return mdiFan;
    if (commandType.includes('Automation')) return mdiHomeAutomation;
    if (commandType.includes('Switch')) return mdiToggleSwitchOutline;
    return mdiMinusBox;
};

export default function EinkSimulator({ widgets, onWidgetsChange, entities = [] }: EinkSimulatorProps) {
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
    const [iconPickerOpen, setIconPickerOpen] = useState<'on' | 'off' | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track where exactly on the widget the user clicked to prevent jumping 
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    const handleContainerClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            setSelectedWidgetId(null);
        }
    };

    // Refs for drag and drop to avoid stale closures in window event listeners
    const draggingRef = useRef(dragging);
    const widgetsRef = useRef(widgets);
    const onWidgetsChangeRef = useRef(onWidgetsChange);

    React.useEffect(() => {
        draggingRef.current = dragging;
        widgetsRef.current = widgets;
        onWidgetsChangeRef.current = onWidgetsChange;
    }, [dragging, widgets, onWidgetsChange]);

    const handlePointerDown = (id: string, e: React.PointerEvent) => {
        e.stopPropagation();
        // Only accept left click dragging or touch
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        setSelectedWidgetId(id);

        const widget = widgetsRef.current.find(w => w.id === id);
        if (widget && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pointerX = (e.clientX - rect.left) / SCALE;
            const pointerY = (e.clientY - rect.top) / SCALE;

            // Record the offset from the top left corner of the widget
            dragOffsetRef.current = {
                x: pointerX - widget.pos_x,
                y: pointerY - widget.pos_y
            };

            setDragging(id);
        }
    };

    React.useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!draggingRef.current || !containerRef.current) return;
            e.preventDefault(); // Prevent scrolling while dragging

            const rect = containerRef.current.getBoundingClientRect();

            // Calculate new X, Y in the unscaled 540x960 coordinate system
            let newX = ((e.clientX - rect.left) / SCALE) - dragOffsetRef.current.x;
            let newY = ((e.clientY - rect.top) / SCALE) - dragOffsetRef.current.y;

            // Constrain bounds loosely
            newX = Math.max(0, Math.min(newX, DISPLAY_WIDTH - 50));
            newY = Math.max(0, Math.min(newY, DISPLAY_HEIGHT - 50));

            // Snap to 10px grid
            newX = Math.round(newX / 10) * 10;
            newY = Math.round(newY / 10) * 10;

            onWidgetsChangeRef.current(widgetsRef.current.map(w =>
                w.id === draggingRef.current ? { ...w, pos_x: newX, pos_y: newY } : w
            ));
        };

        const handlePointerUp = () => {
            setDragging(null);
        };

        if (dragging) {
            window.addEventListener('pointermove', handlePointerMove, { passive: false });
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('touchmove', handlePointerMove as any, { passive: false });
            window.addEventListener('touchend', handlePointerUp);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('touchmove', handlePointerMove as any);
            window.removeEventListener('touchend', handlePointerUp);
        };
    }, [dragging]);

    const addWidget = (type: WidgetType) => {
        const newWidget: WidgetConfig = {
            id: Math.random().toString(36).substring(2, 11),
            type,
            entity_id: 'light.example',
            label: 'New ' + type,
            icon_on: type === 'Slider' ? 'lightbulb_outline' : 'fan',
            icon_off: type === 'Slider' ? 'lightbulb_off_outline' : 'fan_off',
            pos_x: 60,
            pos_y: 60 + widgets.length * 100,
            command_type: type === 'Slider' ? 'SetLightBrightnessPercentage' : 'SwitchOnOff',
            ...(type === 'Slider' ? { width: 420, height: 170 } : {})
        };
        onWidgetsChange([...widgets, newWidget]);
        setSelectedWidgetId(newWidget.id);
    };

    const removeSelected = () => {
        if (selectedWidgetId) {
            onWidgetsChangeRef.current(widgetsRef.current.filter(w => w.id !== selectedWidgetId));
            setSelectedWidgetId(null);
        }
    };

    const updateSelected = (updates: Partial<WidgetConfig>) => {
        if (selectedWidgetId) {
            onWidgetsChange(widgets.map(w =>
                w.id === selectedWidgetId ? { ...w, ...updates } : w
            ));
        }
    };

    const selectedWidget = widgets.find(w => w.id === selectedWidgetId);

    // Filter entities based on the currently selected widget's likely domain
    const filteredEntityOptions = useMemo(() => {
        if (!selectedWidget) return [];
        // Determine domains to prioritize depending on the widget type / command
        let validPrefixes: string[] = [];

        switch (selectedWidget.type) {
            case 'Slider':
                validPrefixes = ['light.', 'fan.', 'cover.', 'climate.', 'media_player.'];
                break;
            case 'Button':
                validPrefixes = ['light.', 'switch.', 'input_boolean.', 'script.', 'automation.', 'scene.', 'fan.'];
                break;
            default:
                validPrefixes = [];
        }

        const filtered = entities.filter(e => validPrefixes.some(p => e.entity_id.startsWith(p)));
        // If an entity was somehow manually set outside this list, we still want to show it.
        const currentSelectedValid = entities.find(e => e.entity_id === selectedWidget.entity_id);
        if (currentSelectedValid && !filtered.includes(currentSelectedValid)) {
            filtered.push(currentSelectedValid);
        }

        return filtered.map(ent => ({
            value: ent.entity_id,
            label: `${ent.friendly_name} (${ent.entity_id})`
        }));
    }, [entities, selectedWidget]);

    const reactSelectStyles = {
        control: (provided: any) => ({
            ...provided,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderColor: '#374151',
            borderRadius: '0.5rem',
            padding: '2px',
            color: 'white',
        }),
        menu: (provided: any) => ({
            ...provided,
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            overflow: 'hidden'
        }),
        option: (provided: any, state: any) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#374151' : 'transparent',
            color: 'white',
            cursor: 'pointer'
        }),
        singleValue: (provided: any) => ({
            ...provided,
            color: 'white'
        }),
        input: (provided: any) => ({
            ...provided,
            color: 'white'
        })
    };

    return (
        <div className="flex gap-8 flex-col lg:flex-row">
            {/* E-Ink Visual Display */}
            <div className="flex flex-col items-center gap-4">
                <div
                    ref={containerRef}
                    onClick={handleContainerClick}
                    style={{
                        width: DISPLAY_WIDTH * SCALE,
                        height: DISPLAY_HEIGHT * SCALE,
                        backgroundColor: '#e0e0e0', // Simulating e-ink background
                        position: 'relative',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1), 0 10px 25px rgba(0,0,0,0.5)',
                        border: '8px solid #222',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        cursor: dragging ? 'grabbing' : 'default',
                        touchAction: 'none',
                        userSelect: 'none'
                    }}
                >
                    {widgets.map((w, index) => {
                        const style: React.CSSProperties = {
                            position: 'absolute',
                            left: w.pos_x * SCALE,
                            top: w.pos_y * SCALE,
                            border: `2px solid ${w.id === selectedWidgetId ? '#3B82F6' : '#666'}`,
                            backgroundColor: '#fff',
                            color: '#000',
                            padding: '12px',
                            borderRadius: '12px',
                            cursor: dragging === w.id ? 'grabbing' : 'grab',
                            boxShadow: w.id === selectedWidgetId ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: dragging === w.id ? 'none' : 'box-shadow 0.2s, border 0.2s',
                        };

                        if (w.type === 'Slider') {
                            style.width = (w.width || 480) * SCALE;
                            style.height = (w.height || 170) * SCALE;
                        } else {
                            style.width = 100 * SCALE;
                            style.height = 100 * SCALE;
                        }

                        return (
                            <div
                                key={w.id || `widget-${index}`}
                                style={style}
                                onPointerDown={(e) => handlePointerDown(w.id, e)}
                                className="group relative text-center select-none"
                            >
                                <Icon
                                    path={getIconForWidget(w.command_type)}
                                    size={w.type === 'Slider' ? 1.5 : 1}
                                    className={`${w.type === 'Slider' ? 'mb-2 opacity-80' : 'mb-1 opacity-80'} text-gray-800`}
                                />
                                <span className={`font-bold text-gray-900 leading-tight ${w.type === 'Slider' ? 'text-sm' : 'text-[10px]'}`}>
                                    {w.label || 'Unnamed'}
                                </span>

                                {w.type === 'Slider' && (
                                    <div className="w-[80%] h-2 bg-gray-200 mt-3 rounded-full overflow-hidden">
                                        <div className="w-[50%] h-full bg-gray-600 rounded-full" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => addWidget('Slider')} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-gray-700 hover:border-gray-500 flex items-center gap-2">
                        <Icon path={mdiMinusBox} size={0.7} /> Add Slider
                    </button>
                    <button onClick={() => addWidget('Button')} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-gray-700 hover:border-gray-500 flex items-center gap-2">
                        <Icon path={mdiToggleSwitchOutline} size={0.7} /> Add Button
                    </button>
                </div>
            </div>

            {/* Properties Panel */}
            <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl p-6 h-fit backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4">Widget Properties</h3>

                {!selectedWidget ? (
                    <div className="text-gray-500 text-sm flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-800 rounded-xl">
                        <Icon path={mdiToggleSwitchOutline} size={2} className="opacity-20 mb-2" />
                        <p>Select a widget on the display to edit its properties.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-blue-400 uppercase tracking-wider font-extrabold flex items-center justify-between">
                                Home Assistant Entity
                                <span className="text-[10px] bg-blue-900/40 px-2 py-0.5 rounded text-blue-300 font-medium">Searchable</span>
                            </label>
                            {entities.length > 0 ? (
                                <Select
                                    value={filteredEntityOptions.find(opt => opt.value === selectedWidget.entity_id) || null}
                                    onChange={(option: any) => {
                                        if (option) {
                                            const entityItem = entities.find(e => e.entity_id === option.value);

                                            // Automatically guess best command type based on entity domain and widget type
                                            let newCmd = selectedWidget.command_type;
                                            if (selectedWidget.type === 'Slider') {
                                                if (option.value.startsWith('cover.')) newCmd = 'SetCoverPositionPercentage';
                                                else if (option.value.startsWith('fan.')) newCmd = 'SetFanSpeedPercentage';
                                                else if (option.value.startsWith('light.')) newCmd = 'SetLightBrightnessPercentage';
                                            } else {
                                                if (option.value.startsWith('automation.')) newCmd = 'AutomationOnOff';
                                                else newCmd = 'SwitchOnOff';
                                            }

                                            updateSelected({
                                                entity_id: option.value,
                                                label: entityItem?.friendly_name || selectedWidget.label,
                                                command_type: newCmd
                                            });
                                        }
                                    }}
                                    options={filteredEntityOptions}
                                    styles={reactSelectStyles}
                                    placeholder="Search for an entity..."
                                    className="text-sm"
                                    noOptionsMessage={() => "No matching entities found in HA."}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={selectedWidget.entity_id}
                                    onChange={e => updateSelected({ entity_id: e.target.value })}
                                    placeholder="e.g. light.living_room"
                                    className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none w-full"
                                />
                            )}
                            <p className="text-[10px] text-gray-500">Only showing {selectedWidget.type === 'Slider' ? 'slider-compatible (e.g. lights, covers)' : 'button-compatible'} entities by default.</p>
                        </div>

                        <div className="flex flex-col gap-1 mt-2">
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Display Label</label>
                            <input
                                type="text"
                                value={selectedWidget.label}
                                onChange={e => updateSelected({ label: e.target.value })}
                                className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-base font-bold text-white focus:border-blue-500 outline-none w-full"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-900 mx-[-1.5rem] px-6 py-4 my-2 border-y border-gray-800">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">X Position</label>
                                <input
                                    type="number"
                                    value={selectedWidget.pos_x}
                                    onChange={e => updateSelected({ pos_x: parseInt(e.target.value) || 0 })}
                                    className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Y Position</label>
                                <input
                                    type="number"
                                    value={selectedWidget.pos_y}
                                    onChange={e => updateSelected({ pos_y: parseInt(e.target.value) || 0 })}
                                    className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            {selectedWidget.type === 'Slider' && (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Width</label>
                                        <input
                                            type="number"
                                            value={selectedWidget.width}
                                            onChange={e => updateSelected({ width: parseInt(e.target.value) || 100 })}
                                            className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Height</label>
                                        <input
                                            type="number"
                                            value={selectedWidget.height}
                                            onChange={e => updateSelected({ height: parseInt(e.target.value) || 100 })}
                                            className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Firmware Command</label>
                            <select
                                value={selectedWidget.command_type}
                                onChange={e => updateSelected({ command_type: e.target.value })}
                                className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none w-full appearance-none"
                            >
                                <option value="SetLightBrightnessPercentage">SetLightBrightnessPercentage</option>
                                <option value="SetCoverPositionPercentage">SetCoverPositionPercentage</option>
                                <option value="SetFanSpeedPercentage">SetFanSpeedPercentage</option>
                                <option value="SwitchOnOff">SwitchOnOff</option>
                                <option value="AutomationOnOff">AutomationOnOff</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Icon (On)</label>
                                <button
                                    onClick={() => setIconPickerOpen('on')}
                                    className="flex items-center justify-between text-sm border border-gray-700 rounded-lg bg-black/50 px-3 py-2.5 text-white hover:bg-gray-800 transition-colors border-dashed hover:border-blue-500"
                                >
                                    <span className="truncate max-w-[120px]">{selectedWidget.icon_on?.replace(/^mdi/, '') || 'Choose Icon...'}</span>
                                    <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">Browse</span>
                                </button>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Icon (Off)</label>
                                <button
                                    onClick={() => setIconPickerOpen('off')}
                                    className="flex items-center justify-between text-sm border border-gray-700 rounded-lg bg-black/50 px-3 py-2.5 text-white hover:bg-gray-800 transition-colors border-dashed hover:border-blue-500"
                                >
                                    <span className="truncate max-w-[120px]">{selectedWidget.icon_off?.replace(/^mdi/, '') || 'Choose Icon...'}</span>
                                    <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">Browse</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={removeSelected}
                            className="mt-6 bg-red-900/30 hover:bg-red-900/60 text-red-400 font-bold px-4 py-3 rounded-xl border border-red-800/30 transition-colors w-full"
                        >
                            Delete {selectedWidget.type}
                        </button>
                    </div>
                )
                }
            </div >

            {/* Icon Picker Modal overlay */}
            <IconPickerModal
                isOpen={iconPickerOpen !== null}
                onClose={() => setIconPickerOpen(null)}
                onSelect={(val) => {
                    if (iconPickerOpen === 'on') updateSelected({ icon_on: val });
                    else if (iconPickerOpen === 'off') updateSelected({ icon_off: val });
                    setIconPickerOpen(null);
                }}
            />
        </div >
    );
}
