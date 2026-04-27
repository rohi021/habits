import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import confetti from 'canvas-confetti';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from '../config';
import { DateUtils, StatsUtils, HabitUtils } from '../utils';
import { AnalyticsEngine, CognitiveEngine, ResearchEngine, AccountabilityEngine, PredictiveEngine, SkillTreeEngine } from '../engines';
import { ActionTypes, AppContext } from '../context';
import { IconButton, ProgressRing, Badge, EmptyState, Skeleton, StatCard, HabitItem } from './ui';
import { FocusTimer, HabitModal, StudyTimer, AssignmentModal, TimetableModal, WellnessModal, JournalEntryModal, ExpenseModal, ResearchModal, SubjectManagerModal } from './modals';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './panels';
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './views';

export const AccountabilityConsole = memo(({ alerts, entropy, comfortZone, streakReliability }) => {
    const severityColors = {
        danger: 'border-rose-600 bg-rose-950/30 text-rose-300',
        warning: 'border-amber-600 bg-amber-950/30 text-amber-300',
        info: 'border-slate-600 bg-slate-800/30 text-slate-400'
    };

    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Accountability Console</div>
            
            {/* Key metrics row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-slate-800/50 rounded">
                    <div className="text-lg font-mono font-bold text-slate-300">{entropy.value}</div>
                    <div className="text-xs text-slate-500">Entropy</div>
                </div>
                <div className="text-center p-2 bg-slate-800/50 rounded">
                    <div className={`text-lg font-mono font-bold ${comfortZone.detected ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {comfortZone.detected ? 'YES' : 'NO'}
                    </div>
                    <div className="text-xs text-slate-500">Comfort Zone</div>
                </div>
                <div className="text-center p-2 bg-slate-800/50 rounded">
                    <div className="text-lg font-mono font-bold text-slate-300">{streakReliability.value}%</div>
                    <div className="text-xs text-slate-500">Streak Rel.</div>
                </div>
            </div>

            {/* Alerts */}
            <div className="space-y-1.5">
                {alerts.length === 0 ? (
                    <div className="text-xs text-slate-600 font-mono">No critical alerts. Execution nominal.</div>
                ) : (
                    alerts.map((alert, i) => (
                        <div key={i} className={`text-xs font-mono p-2 rounded border ${severityColors[alert.severity] || severityColors.info}`}>
                            {alert.message}
                        </div>
                    ))
                )}
            </div>

            {/* Fragile streaks */}
            {streakReliability.fragileHabits.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-500 font-mono mb-1">Fragile Streaks:</div>
                    {streakReliability.fragileHabits.map((h, i) => (
                        <div key={i} className="text-xs font-mono text-amber-400">
                            • {h.name}: {h.streak}d current vs {h.longest}d peak (gap: {h.gap}d)
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

/**
 * Skill Tree Panel
 */
export const CommandDashboard = memo(() => {
    const { state } = useApp();
    const [showResearchModal, setShowResearchModal] = useState(false);

    // Memoized metric computations
    const dailyMetrics = useMemo(() => CognitiveEngine.extractDailyMetrics(state, 30), [
        state.sleepLog, state.studySessions, state.habits, state.habitOrder,
        state.exerciseLog, state.moodLog, state.assignments, state.journalEntries
    ]);

    const csi = useMemo(() => CognitiveEngine.computeCSI(dailyMetrics), [dailyMetrics]);
    const deepWork = useMemo(() => CognitiveEngine.computeDeepWorkCapacity(dailyMetrics, state.studyGoal?.daily || 120), [dailyMetrics, state.studyGoal]);
    const burnout = useMemo(() => CognitiveEngine.computeBurnoutProbability(dailyMetrics, state), [dailyMetrics, state]);
    const focusStability = useMemo(() => CognitiveEngine.computeFocusStability(dailyMetrics), [dailyMetrics]);
    const decisionFatigue = useMemo(() => CognitiveEngine.computeDecisionFatigueRisk(dailyMetrics, state), [dailyMetrics, state]);
    const cognitiveLoad = useMemo(() => CognitiveEngine.computeCognitiveLoad(state), [state.assignments]);
    const outputEffort = useMemo(() => CognitiveEngine.computeOutputEffortRatio(dailyMetrics, state), [dailyMetrics, state]);

    const researchVelocity = useMemo(() => ResearchEngine.computeResearchVelocity(state.researchLog), [state.researchLog]);
    const innovationMomentum = useMemo(() => ResearchEngine.computeInnovationMomentum(state.researchLog), [state.researchLog]);
    const learningAccel = useMemo(() => ResearchEngine.computeLearningAcceleration(state.researchLog), [state.researchLog]);
    const debugEfficiency = useMemo(() => ResearchEngine.computeDebuggingEfficiency(state.researchLog), [state.researchLog]);

    const entropy = useMemo(() => AccountabilityEngine.computeConsistencyEntropy(dailyMetrics), [dailyMetrics]);
    const comfortZone = useMemo(() => AccountabilityEngine.computeComfortZoneScore(dailyMetrics), [dailyMetrics]);
    const activeHabits = useMemo(() => state.habitOrder.map(id => state.habits[id]).filter(h => h && !h.archived), [state.habits, state.habitOrder]);
    const streakReliability = useMemo(() => AccountabilityEngine.computeStreakReliability(activeHabits), [activeHabits]);
    const accountabilityAlerts = useMemo(() => AccountabilityEngine.generateAlerts(dailyMetrics, state), [dailyMetrics, state]);

    const deadlineRisks = useMemo(() => PredictiveEngine.computeDeadlineRisks(state), [state.assignments]);
    const sleepRegression = useMemo(() => PredictiveEngine.computeSleepPerformanceRegression(dailyMetrics), [dailyMetrics]);
    const skillGaps = useMemo(() => PredictiveEngine.computeSkillGaps(state), [state.studySessions, state.assignments]);

    const skillProgress = useMemo(() => SkillTreeEngine.computeSkillProgress(state.skillXP), [state.skillXP]);
    const contributionData = useMemo(() => SkillTreeEngine.generateContributionHeatmap(state, 84), [state]);

    const metrics = { csi, burnout, researchVelocity, focusStability, deepWork };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white font-mono tracking-tight">Command Center</h2>
                    <p className="text-xs text-slate-500 font-mono">Cognitive Performance Intelligence</p>
                </div>
                <button
                    onClick={() => setShowResearchModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono rounded-lg transition-colors"
                >
                    + Research
                </button>
            </div>

            {/* Cognitive Load Bar */}
            <CognitiveLoadBar value={cognitiveLoad.value} level={cognitiveLoad.level} />

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard label="CSI" value={csi.value} suffix="/100" trend={csi.trend} color="indigo" />
                <MetricCard label="Burnout Risk" value={burnout.value} suffix="%" trend={burnout.risk === 'high' ? 'down' : undefined}
                    color={burnout.risk === 'high' ? 'rose' : burnout.risk === 'medium' ? 'amber' : 'emerald'} />
                <MetricCard label="Deep Work" value={deepWork.value} suffix="%" trend={deepWork.trend} color="cyan" />
                <MetricCard label="Focus" value={focusStability.value} suffix="/100" trend={focusStability.trend} color="purple" />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Decision Fatigue" value={decisionFatigue.value} suffix="%" 
                    color={decisionFatigue.risk === 'high' ? 'rose' : 'amber'} detail={decisionFatigue.risk} />
                <MetricCard label="Output/Effort" value={outputEffort.value} suffix="/100"
                    detail={`${outputEffort.totalStudyHours}h studied`} color="emerald" />
                <MetricCard label="Cog. Load" value={cognitiveLoad.value} suffix="%"
                    detail={`${cognitiveLoad.pendingCount} pending`} color={cognitiveLoad.level === 'red' ? 'rose' : 'amber'} />
            </div>

            {/* Performance Radar */}
            <RadarPanel metrics={metrics} />

            {/* Research Intelligence */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard label="Research Vel." value={researchVelocity.value} trend={researchVelocity.trend} color="purple" />
                <MetricCard label="Innovation" value={innovationMomentum.value} detail={innovationMomentum.direction} color="indigo" />
                <MetricCard label="Learning Accel." value={learningAccel.value} 
                    detail={learningAccel.accelerating ? 'Accelerating' : 'Steady'} color="cyan" />
                <MetricCard label="Debug Eff." value={debugEfficiency.value} suffix="/100" color="amber" />
            </div>

            {/* Contribution Heatmap */}
            <MiniHeatmap data={contributionData} label="Activity — Last 12 Weeks" weeks={12} />

            {/* Skill Trees */}
            <SkillTreePanel skillProgress={skillProgress} />

            {/* Weekly Audit */}
            <WeeklyAuditPanel dailyMetrics={dailyMetrics} />

            {/* Predictive Analytics */}
            {(deadlineRisks.length > 0 || skillGaps.length > 0) && (
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Predictive Analytics</div>
                    
                    {deadlineRisks.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs text-slate-400 font-mono mb-1">Deadline Risks</div>
                            {deadlineRisks.slice(0, 3).map((r, i) => (
                                <div key={i} className="flex justify-between items-center text-xs font-mono py-1">
                                    <span className="text-slate-300 truncate mr-2">{r.title}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">{r.daysLeft}d left</span>
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                                            r.level === 'high' ? 'bg-rose-900/50 text-rose-400' :
                                            r.level === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                                            'bg-slate-800 text-slate-400'
                                        }`}>{r.risk}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {sleepRegression.correlation !== 0 && (
                        <div className="mb-3">
                            <div className="text-xs text-slate-400 font-mono mb-1">Sleep → Performance</div>
                            <div className="text-xs font-mono text-slate-500">
                                <span>r={sleepRegression.correlation}</span>
                                <span aria-hidden="true"> · </span>
                                <span>Optimal: {sleepRegression.optimalSleep}h</span>
                                <span aria-hidden="true"> · </span>
                                <span>Each +1h sleep ≈ +{sleepRegression.slope}% performance</span>
                            </div>
                        </div>
                    )}

                    {skillGaps.length > 0 && (
                        <div>
                            <div className="text-xs text-slate-400 font-mono mb-1">Skill Gaps Detected</div>
                            {skillGaps.map((g, i) => (
                                <div key={i} className="text-xs font-mono text-amber-400">
                                    • {g.subject}: {g.completionRate}% completion, {g.studyMinutes}min studied
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Accountability Console */}
            <AccountabilityConsole
                alerts={accountabilityAlerts}
                entropy={entropy}
                comfortZone={comfortZone}
                streakReliability={streakReliability}
            />

            {/* Burnout Risk Factors */}
            {burnout.factors.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Burnout Risk Factors</div>
                    {burnout.factors.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs font-mono py-1">
                            <span className="text-slate-400">{f.name}</span>
                            <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden my-auto">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, f.severity * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Research Log */}
            {(state.researchLog || []).length > 0 && (
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
                    <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Recent Research Activity</div>
                    <div className="space-y-2">
                        {(state.researchLog || []).slice(-5).reverse().map(entry => {
                            const typeIcons = { paper: '📄', experiment: '🧪', model: '🧠', deployment: '🚀', insight: '💡', bugfix: '🐛' };
                            return (
                                <div key={entry.id} className="flex items-start gap-2 text-xs font-mono">
                                    <span>{typeIcons[entry.type] || '📝'}</span>
                                    <div className="flex-1">
                                        <div className="text-slate-300">{entry.title}</div>
                                        <div className="text-slate-600">{entry.date} • {entry.duration}min • {SKILL_DOMAINS[entry.domain]?.name || entry.domain}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Research Modal */}
            {showResearchModal && <ResearchModal onClose={() => setShowResearchModal(false)} />}
        </div>
    );
});

// ============================================================================
// SECTION 8B: SUBJECT MANAGER MODAL
// ============================================================================

export const App = () => {
    const [state, dispatch] = useReducer(appReducer, null, createInitialState);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSubjectManager, setShowSubjectManager] = useState(false);
    const [fabOpen, setFabOpen] = useState(false);
    const isOnline = useOnlineStatus();
    
    // Load persisted state
    useLoadState(dispatch);
    
    // Persist state changes
    usePersistedState(state, state.isLoading);
    
    // Keyboard shortcuts
    useKeyboardShortcuts(dispatch, state);
    
    // Auto-end focus mode when time expires
    useEffect(() => {
        const fm = state.focusMode;
        if (fm?.mode && fm.mode !== 'off' && fm.endsAt) {
            const remaining = new Date(fm.endsAt) - new Date();
            if (remaining <= 0) {
                dispatch({ type: ActionTypes.END_DEEP_WORK });
                showToast('Focus session ended');
            } else {
                const timer = setTimeout(() => {
                    dispatch({ type: ActionTypes.END_DEEP_WORK });
                    showToast('Focus session complete! 🎉', 'success');
                }, remaining);
                return () => clearTimeout(timer);
            }
        }
    }, [state.focusMode?.endsAt, state.focusMode?.mode, dispatch]);
    
    // Update focus banner every second (for countdown display)
    const [, setTick] = useState(0);
    useEffect(() => {
        if (state.focusMode?.mode && state.focusMode.mode !== 'off' && state.focusMode?.endsAt) {
            const interval = setInterval(() => setTick(t => t + 1), 1000);
            return () => clearInterval(interval);
        }
    }, [state.focusMode?.mode, state.focusMode?.endsAt]);
    
    // View components
    const viewComponents = {
        dashboard: DashboardPage,
        study: StudyView,
        analytics: AnalyticsView,
        journal: JournalView,
        expenses: ExpenseView,
        settings: SettingsView,
        matrix: MatrixView,
        command: CommandDashboard,
        grades: GradeTrackerView,
        calendar: CalendarView,
        goals: GoalView
    };
    
    const CurrentView = viewComponents[state.view] || DashboardPage;
    
    // Loading state
    if (state.isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading your habits...</p>
                </div>
            </div>
        );
    }
    
    return (
        <AppContext.Provider value={{ state, dispatch }}>
            <div className="min-h-screen bg-slate-950 text-white">
                {/* Offline Banner */}
                {!isOnline && (
                    <div 
                        className="bg-amber-600 text-white text-center py-2 text-sm"
                        role="alert"
                    >
                        📴 You're offline. Changes are saved locally.
                    </div>
                )}
                
                {/* Header */}
                <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
                    <div className="max-w-2xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
                                    📚
                                </div>
                                <div>
                                    <h1 className="font-bold text-white text-lg">{CONFIG.APP_NAME}</h1>
                                    <p className="text-xs text-slate-400">
                                        {DateUtils.format(new Date(), { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {/* XP/Level Indicator */}
                                <div className="hidden sm:flex flex-col items-end">
                                    <div className="text-xs text-indigo-400 font-semibold">
                                        Level {state.level} • {Object.entries(CONFIG.LEVEL_TITLES).reverse().find(([lvl]) => state.level >= parseInt(lvl))?.[1] || 'Freshman'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {state.xp} XP
                                    </div>
                                </div>
                                
                                {/* Notification Bell */}
                                <button
                                    onClick={() => {
                                        if (state.focusMode?.mode !== 'off' && state.focusMode?.mode && state.focusMode?.endsAt && new Date(state.focusMode.endsAt) > new Date()) {
                                            showToast('Notifications silenced during focus mode');
                                            return;
                                        }
                                        setShowNotifications(true);
                                    }}
                                    className="relative p-2 text-slate-400 hover:text-white transition-colors"
                                    aria-label="Notifications"
                                >
                                    <span className="text-lg">🔔</span>
                                    {(state.notifications || []).filter(n => !n.read).length > 0 && (!state.focusMode?.mode || state.focusMode?.mode === 'off') && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-xs text-white flex items-center justify-center">
                                            {(state.notifications || []).filter(n => !n.read).length}
                                        </span>
                                    )}
                                </button>
                                
                                {/* Deep Work Toggle */}
                                <button
                                    onClick={() => {
                                        if (state.focusMode?.mode !== 'off' && state.focusMode?.mode) {
                                            dispatch({ type: ActionTypes.END_DEEP_WORK });
                                            showToast('Focus mode ended');
                                        } else {
                                            const mins = prompt('Deep Work duration (minutes):', '50');
                                            if (!mins) return;
                                            const m = parseInt(mins);
                                            if (isNaN(m) || m < 1) return;
                                            dispatch({ type: ActionTypes.START_DEEP_WORK, payload: { durationMinutes: m, mode: 'deepWork' }});
                                            showToast(`Deep Work: ${m} min started`, 'success');
                                        }
                                    }}
                                    className={`p-2 transition-colors ${state.focusMode?.mode !== 'off' && state.focusMode?.mode ? 'text-violet-400' : 'text-slate-400 hover:text-white'}`}
                                    aria-label="Toggle Deep Work"
                                >
                                    <span className="text-lg">🎯</span>
                                </button>
                                
                                {/* Undo/Redo Buttons */}
                                <div className="flex items-center gap-1">
                                    <IconButton
                                        icon="↩️"
                                        label="Undo (Ctrl+Z)"
                                        onClick={() => {
                                            dispatch({ type: ActionTypes.UNDO });
                                            showToast('Undone');
                                        }}
                                        disabled={state.undoStack.length === 0}
                                        size="sm"
                                    />
                                    <IconButton
                                        icon="↪️"
                                        label="Redo (Ctrl+Shift+Z)"
                                        onClick={() => {
                                            dispatch({ type: ActionTypes.REDO });
                                            showToast('Redone');
                                        }}
                                        disabled={state.redoStack.length === 0}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* XP Progress Bar */}
                        <div className="mt-2 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                style={{ 
                                    width: `${((state.xp % (state.level * state.level * CONFIG.XP_PER_LEVEL)) / (state.level * state.level * CONFIG.XP_PER_LEVEL)) * 100}%` 
                                }}
                            />
                        </div>
                    </div>
                </header>
                
                {/* Deep Work Focus Banner */}
                {state.focusMode?.mode !== 'off' && state.focusMode?.mode && state.focusMode?.endsAt && (() => {
                    const remaining = Math.max(0, Math.floor((new Date(state.focusMode.endsAt) - new Date()) / 1000));
                    const mins = Math.floor(remaining / 60);
                    const secs = remaining % 60;
                    return remaining > 0 ? (
                        <div className="bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">🎯</span>
                                <span className="text-white text-sm font-medium">
                                    {state.focusMode.mode === 'deepWork' ? 'Deep Work' : 'Study Only'} — {mins}:{secs.toString().padStart(2, '0')} left
                                </span>
                            </div>
                            <button onClick={() => dispatch({ type: ActionTypes.END_DEEP_WORK })}
                                className="text-xs px-2 py-1 bg-white/20 text-white rounded hover:bg-white/30" aria-label="End focus mode">End</button>
                        </div>
                    ) : null;
                })()}
                
                {/* Main Content */}
                <main 
                    id="main-content"
                    className="max-w-2xl mx-auto px-4 py-6 pb-32"
                    role="main"
                >
                    <CurrentView />
                </main>
                
                {/* Bottom Navigation */}
                <nav 
                    className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 z-40"
                    role="navigation"
                    aria-label="Main navigation"
                >
                    <div className="max-w-2xl mx-auto px-2">
                        <div className="flex items-center justify-around py-2">
                            {[
                                { id: 'dashboard', icon: '🏠', label: 'Home' },
                                { id: 'study', icon: '📚', label: 'Study' },
                                { id: 'analytics', icon: '📊', label: 'Stats' },
                                { id: 'journal', icon: '📓', label: 'Journal' },
                                { id: 'settings', icon: '⚙️', label: 'Settings' }
                            ].filter(item => {
                                // Hide tabs during focus mode
                                const fm = state.focusMode;
                                if (fm?.mode && fm.mode !== 'off' && fm.endsAt && new Date(fm.endsAt) > new Date()) {
                                    return !(fm.hideTabs || []).includes(item.id);
                                }
                                return true;
                            }).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: item.id })}
                                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all touch-target ${
                                        state.view === item.id
                                            ? 'text-indigo-400 bg-indigo-500/10'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    aria-current={state.view === item.id ? 'page' : undefined}
                                    aria-label={item.label}
                                >
                                    <span className="text-xl" aria-hidden="true">{item.icon}</span>
                                    <span className="text-xs font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Safe area padding for devices with home indicator */}
                    <div className="h-[env(safe-area-inset-bottom)]" />
                </nav>
                
                {/* Floating Action Button (only on dashboard) */}
                {state.view === 'dashboard' && (
                    <div className="fixed bottom-24 right-6 z-30">
                        {fabOpen && (
                            <div className="absolute bottom-16 right-0 space-y-2 mb-2">
                                {[
                                    { icon: '⏱️', label: 'Start Study', action: () => dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' }) },
                                    { icon: '📝', label: 'Add Assignment', action: () => dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' }) },
                                    { icon: '💰', label: 'Log Expense', action: () => dispatch({ type: ActionTypes.SET_VIEW, payload: 'expenses' }) },
                                    { icon: '📓', label: 'Write Journal', action: () => dispatch({ type: ActionTypes.SET_VIEW, payload: 'journal' }) },
                                    { icon: '💧', label: '+1 Water', action: () => {
                                        const today = DateUtils.toKey();
                                        dispatch({ type: ActionTypes.LOG_WATER, payload: { date: today, glasses: (state.waterLog[today] || 0) + 1 } });
                                        dispatch({ type: ActionTypes.ADD_XP, payload: { amount: 1 } });
                                        showToast('+1 water 💧 +1 XP');
                                    }},
                                ].map((item, i) => (
                                    <button key={i} onClick={() => { item.action(); setFabOpen(false); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full shadow-lg border border-slate-700 text-white text-sm whitespace-nowrap hover:bg-slate-700 transition-colors">
                                        <span>{item.icon}</span> {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setFabOpen(!fabOpen)}
                            className={`w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 touch-target ${fabOpen ? 'rotate-45' : ''}`}
                            aria-label="Quick actions"
                        >
                            <span className="text-2xl text-white" aria-hidden="true">+</span>
                        </button>
                    </div>
                )}
                
                {/* Global Add Modal */}
                {showAddModal && (
                    <HabitModal onClose={() => setShowAddModal(false)} />
                )}
                
                {/* Notification Panel */}
                {showNotifications && (
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                )}
                
                {/* Subject Manager */}
                {showSubjectManager && (
                    <SubjectManagerModal onClose={() => setShowSubjectManager(false)} />
                )}
            </div>
        </AppContext.Provider>
    );
};

// ============================================================================
// SECTION 10: APP INITIALIZATION
// ============================================================================

// Mount the application
