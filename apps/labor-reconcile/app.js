// Labor Hours Comparison Tool - React Component
const { useState, useMemo } = React;

// Icon components (simplified SVG versions)
const Upload = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

const AlertCircle = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckCircle = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const Copy = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ChevronDown = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronRight = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ArrowUpDown = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />
  </svg>
);

const Lightbulb = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a5 5 0 1 0-6 0c0 2.5 2 3 3 6 1-3 3-3.5 3-6Z" />
  </svg>
);

const Trash2 = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const RefreshCw = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ArrowLeftRight = ({ size = 24, className = "" }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

// Component code starts here
const PLXCrescentCompare = () => {
  const [plxData, setPlxData] = useState(null);
  const [crescentData, setCrescentData] = useState(null);
  const [editedCrescentRows, setEditedCrescentRows] = useState([]);
  const [editedPlxRows, setEditedPlxRows] = useState([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedShift, setSelectedShift] = useState('1st Shift');
  const [plxFile, setPlxFile] = useState(null);
  const [crescentFile, setCrescentFile] = useState(null);
  const [shift1TotalRow, setShift1TotalRow] = useState(null);
  const [mismatchNotes, setMismatchNotes] = useState({});
  const [crescentErrors, setCrescentErrors] = useState(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [comparisonCollapsed, setComparisonCollapsed] = useState(true);
  const [crescentCollapsed, setCrescentCollapsed] = useState(true);
  const [plxCollapsed, setPlxCollapsed] = useState(true);
  const [crescentSort, setCrescentSort] = useState({ column: 'EID', direction: 'asc' });
  const [plxSort, setPlxSort] = useState({ column: 'EID', direction: 'asc' });
  const [crescentSearch, setCrescentSearch] = useState('');
  const [plxSearch, setPlxSearch] = useState('');
  const [comparisonSearch, setComparisonSearch] = useState('');
  const [originalPlxWorkbook, setOriginalPlxWorkbook] = useState(null);
  const [plxRowMapping, setPlxRowMapping] = useState([]);

  // Parse PLX Excel file
  const parsePLXFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Store original workbook for export
        setOriginalPlxWorkbook(workbook);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const dayRow = jsonData[3] || [];
        const hourTypeRow = jsonData[4] || [];

        const columnMapping = {};
        let currentDay = '';
        const maxCols = Math.max(dayRow.length, hourTypeRow.length);

        for (let idx = 0; idx < maxCols; idx++) {
          const cell = dayRow[idx];
          if (cell && typeof cell === 'string' && cell.trim()) {
            currentDay = cell.trim();
          }
          if (currentDay && currentDay !== 'Weekly Total' && hourTypeRow[idx]) {
            const hourType = hourTypeRow[idx].toString().trim();
            const htLower = hourType.toLowerCase();
            if ((htLower.includes('hrs') || htLower.includes('hours')) &&
                (htLower.includes('reg') || htLower.includes('ot') || htLower.includes('dt'))) {
              columnMapping[idx] = { day: currentDay, hourType };
            }
          }
        }

        const headerRow = jsonData[4];
        const fileColIdx = headerRow.findIndex(h => h && h.toString().toLowerCase().includes('file'));
        const nameColIdx = headerRow.findIndex(h => h && h.toString().toLowerCase().includes('name'));

        let shift1TotalRowIdx = null;
        for (let i = 5; i < jsonData.length; i++) {
          const cellValue = jsonData[i][2]?.toString().toLowerCase() || '';
          if (cellValue.includes('shift') && cellValue.includes('1') && cellValue.includes('total')) {
            shift1TotalRowIdx = i;
            break;
          }
        }
        setShift1TotalRow(shift1TotalRowIdx);

        const records = [];
        const rowMapping = [];
        for (let i = 5; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[fileColIdx]) continue;

          const fileValue = row[fileColIdx].toString();
          const eidMatch = fileValue.match(/\d+/);
          if (!eidMatch) continue;

          const eid = eidMatch[0];
          const name = row[nameColIdx] || '';

          let shift = null;
          if (shift1TotalRowIdx !== null) {
            shift = i < shift1TotalRowIdx ? '1st Shift' : '2nd Shift';
          }

          records.push({
            EID: eid,
            Name: name,
            row: row,
            rowIndex: i,
            columnMapping: columnMapping,
            shift: shift,
            department: row[0]?.toString() || '' // Column A is index 0
          });

          rowMapping.push({
            eid: eid,
            rowIndex: i,
            department: row[0]?.toString() || ''
          });
        }

        setPlxData(records);
        setPlxRowMapping(rowMapping);
      } catch (error) {
        console.error('Error parsing PLX file:', error);
        alert('Error parsing PLX file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse Crescent CSV/Excel file
  const parseCrescentFile = (file) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    
    reader.onload = (e) => {
      try {
        let jsonData;

        if (fileName.endsWith('.csv')) {
          const workbook = XLSX.read(e.target.result, { type: 'string' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        } else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(sheet);
        }

        const aggregated = {};
        let unrecognizedBadgeCounter = 0;

        jsonData.forEach(row => {
          const badgeKey = Object.keys(row).find(k => k.toLowerCase() === 'badge');
          const hoursKey = Object.keys(row).find(k => k.toLowerCase() === 'payable hours');
          const lineKey = Object.keys(row).find(k => k.toLowerCase() === 'line name');
          const clockInKey = Object.keys(row).find(k => k.toLowerCase() === 'clock in time');
          const clockOutKey = Object.keys(row).find(k => k.toLowerCase() === 'clock out time');

          const badge = badgeKey ? row[badgeKey] : '';

          // Skip rows with no badge at all
          if (!badge) return;

          // First try the standard numeric EID format: PLX-(\d+)-
          let eidMatch = badge.toString().match(/PLX-(\d+)-/i);
          let eid = null;
          let isNameBased = false;
          let isUnrecognized = false;

          if (eidMatch) {
            // Standard format found (e.g., PLX-21057999-AND)
            eid = eidMatch[1];
          } else if (badge.toString().toLowerCase().includes('plx')) {
            // Try name-based format: PLX-{name} or plx-{name} (including with spaces like "plx- lastname")
            const nameMatch = badge.toString().match(/PLX-?\s*([A-Za-z]+)/i);
            if (nameMatch) {
              eid = `NAME_${nameMatch[1].toUpperCase()}`;
              isNameBased = true;
            } else {
              // Badge contains PLX but doesn't match any known format - still capture it
              unrecognizedBadgeCounter++;
              eid = `UNRECOGNIZED_${unrecognizedBadgeCounter}`;
              isUnrecognized = true;
            }
          } else {
            // Badge doesn't contain PLX at all - still capture it
            unrecognizedBadgeCounter++;
            eid = `UNRECOGNIZED_${unrecognizedBadgeCounter}`;
            isUnrecognized = true;
          }

          const hours = parseFloat(hoursKey ? row[hoursKey] : 0) || 0;
          const line = lineKey ? row[lineKey] : '';

          if (!aggregated[eid]) {
            aggregated[eid] = {
              EID: eid,
              Badges: new Set(),
              Lines: new Set(),
              Total_Hours: 0,
              Direct_Hours: 0,
              Indirect_Hours: 0,
              ClockIn: '',
              ClockOut: '',
              _isNameBased: isNameBased,
              _isUnrecognized: isUnrecognized,
              _extractedName: isNameBased && !isUnrecognized ? badge.toString().match(/PLX-?\s*([A-Za-z]+)/i)[1] : null
            };
          }

          aggregated[eid].Badges.add(badge.toString());
          aggregated[eid].Lines.add(line);
          aggregated[eid].Total_Hours += hours;

          // Check if this specific line/row is indirect or direct
          const isIndirect = line.toLowerCase().includes('indirect');
          if (isIndirect) {
            aggregated[eid].Indirect_Hours += hours;
          } else {
            aggregated[eid].Direct_Hours += hours;
          }

          if (clockInKey && row[clockInKey]) {
            aggregated[eid].ClockIn = row[clockInKey];
          }
          if (clockOutKey && row[clockOutKey]) {
            aggregated[eid].ClockOut = row[clockOutKey];
          }
        });

        const records = Object.values(aggregated).map(record => ({
          EID: record.EID,
          Badge_Last3: Array.from(record.Badges).map(b => b.slice(-3)).join(', '),
          FullBadges: Array.from(record.Badges).join(', '),
          Lines: Array.from(record.Lines).filter(l => l).join(', '),
          Total_Hours: Math.round(record.Total_Hours * 100) / 100,
          Direct_Hours: Math.round(record.Direct_Hours * 100) / 100,
          Indirect_Hours: Math.round(record.Indirect_Hours * 100) / 100,
          ClockIn: record.ClockIn,
          ClockOut: record.ClockOut,
          _isNameBased: record._isNameBased || false,
          _isUnrecognized: record._isUnrecognized || false,
          _extractedName: record._extractedName || null
        }));

        setCrescentData(records);
        setEditedCrescentRows(records.map(r => ({...r})));
      } catch (error) {
        console.error('Error parsing Crescent file:', error);
        alert('Error parsing Crescent file. Please check the format.');
      }
    };

    if (fileName.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Calculate PLX hours for selected day and shift
  const plxProcessed = useMemo(() => {
    if (!plxData) return [];

    const aggregated = {};
    const filteredData = plxData.filter(record => record.shift === selectedShift);
    
    filteredData.forEach(record => {
      let totalHours = 0;
      let otHours = 0;

      Object.entries(record.columnMapping).forEach(([colIdx, info]) => {
        if (info.day === selectedDay) {
          const value = parseFloat(record.row[colIdx]) || 0;
          totalHours += value;
          if (info.hourType.includes('OT')) {
            otHours += value;
          }
        }
      });

      if (!aggregated[record.EID]) {
        aggregated[record.EID] = {
          EID: record.EID,
          Name: record.Name,
          Total_Hours: 0,
          OT_Hours: 0,
          Direct_Hours: 0,
          Indirect_Hours: 0,
          Department: record.department
        };
      }

      aggregated[record.EID].Total_Hours += totalHours;
      aggregated[record.EID].OT_Hours += otHours;

      // By default PLX hours are Direct unless Dept contains -251-221 (Indirect)
      if (record.department.includes('-251-221')) {
        aggregated[record.EID].Indirect_Hours += totalHours;
      } else {
        aggregated[record.EID].Direct_Hours += totalHours;
      }
    });

    const baseRows = Object.values(aggregated)
      .filter(record => record.Total_Hours > 0)
      .map(record => ({
        ...record,
        Total_Hours: Math.round(record.Total_Hours * 100) / 100,
        OT_Hours: Math.round(record.OT_Hours * 100) / 100,
        Direct_Hours: Math.round(record.Direct_Hours * 100) / 100,
        Indirect_Hours: Math.round(record.Indirect_Hours * 100) / 100
      }));

    setEditedPlxRows(baseRows.map(r => ({...r})));
    return baseRows;
  }, [plxData, selectedDay, selectedShift]);

  const plxForComparison = useMemo(() => {
    return editedPlxRows.map(row => ({
      ...row,
      Total_Hours: parseFloat(row.Total_Hours) || 0
    }));
  }, [editedPlxRows, refreshTrigger]);

  const crescentProcessed = useMemo(() => {
    if (editedCrescentRows.length === 0) return [];
    return editedCrescentRows.map(record => ({
      ...record,
      Total_Hours: parseFloat(record.Total_Hours) || 0
    }));
  }, [editedCrescentRows, refreshTrigger]);

  // Comparison table
  const comparison = useMemo(() => {
    if (!crescentProcessed.length || !plxForComparison.length) return [];

    const allEIDs = new Set([
      ...crescentProcessed.map(r => r.EID),
      ...plxForComparison.map(r => r.EID)
    ]);

    return Array.from(allEIDs).map(eid => {
      const crescentRecord = crescentProcessed.find(r => r.EID === eid);
      const plxRecord = plxForComparison.find(r => r.EID === eid);

      const crescentHours = crescentRecord?.Total_Hours || 0;
      const plxHours = plxRecord?.Total_Hours || 0;
      const diff = Math.abs(crescentHours - plxHours);

      return {
        EID: eid,
        Name: plxRecord?.Name || '',
        Lines: crescentRecord?.Lines || '',
        FullBadges: crescentRecord?.FullBadges || '',
        Badge_Last3: crescentRecord?.Badge_Last3 || '',
        Total_Hours_Crescent: crescentHours,
        Total_Hours_PLX: plxHours,
        Status: diff < 0.01 ? 'Match' : 'Mismatch'
      };
    }).sort((a, b) => a.EID.localeCompare(b.EID));
  }, [crescentProcessed, plxForComparison, refreshTrigger]);

  // Split Crescent rows to show Direct and Indirect separately
  const displayCrescentRows = useMemo(() => {
    const separated = [];
    editedCrescentRows.forEach((row, originalIdx) => {
      const hasIndirect = row.Indirect_Hours > 0;
      const hasDirect = row.Direct_Hours > 0;

      if (hasIndirect && hasDirect) {
        // Split into two rows
        separated.push({
          ...row,
          Lines: 'Indirect',
          Total_Hours: row.Indirect_Hours,
          Direct_Hours: 0,
          Indirect_Hours: row.Indirect_Hours,
          _originalIdx: originalIdx,
          _type: 'indirect',
          _isSplit: true
        });
        separated.push({
          ...row,
          Total_Hours: row.Direct_Hours,
          Direct_Hours: row.Direct_Hours,
          Indirect_Hours: 0,
          _originalIdx: originalIdx,
          _type: 'direct',
          _isSplit: true
        });
      } else {
        // Keep as single row
        separated.push({
          ...row,
          _originalIdx: originalIdx,
          _type: hasIndirect ? 'indirect' : 'direct',
          _isSplit: false
        });
      }
    });
    return separated;
  }, [editedCrescentRows]);

  // Filtered data for search
  const filteredCrescentRows = useMemo(() => {
    if (!crescentSearch.trim()) return displayCrescentRows;
    const searchLower = crescentSearch.toLowerCase();
    return displayCrescentRows.filter(row =>
      row.EID?.toLowerCase().includes(searchLower) ||
      row.FullBadges?.toLowerCase().includes(searchLower) ||
      row.Badge_Last3?.toLowerCase().includes(searchLower) ||
      row.Lines?.toLowerCase().includes(searchLower)
    );
  }, [displayCrescentRows, crescentSearch]);

  // Split PLX rows to show Direct and Indirect separately
  const displayPlxRows = useMemo(() => {
    const separated = [];
    editedPlxRows.forEach((row, originalIdx) => {
      const hasIndirect = row.Indirect_Hours > 0;
      const hasDirect = row.Direct_Hours > 0;

      if (hasIndirect && hasDirect) {
        // Split into two rows
        separated.push({
          ...row,
          Department: '005-251-221 (Indirect)',
          Total_Hours: row.Indirect_Hours,
          Direct_Hours: 0,
          Indirect_Hours: row.Indirect_Hours,
          _originalIdx: originalIdx,
          _type: 'indirect',
          _isSplit: true
        });
        separated.push({
          ...row,
          Department: '004-251-211 (Direct)',
          Total_Hours: row.Direct_Hours,
          Direct_Hours: row.Direct_Hours,
          Indirect_Hours: 0,
          _originalIdx: originalIdx,
          _type: 'direct',
          _isSplit: true
        });
      } else {
        // Keep as single row
        separated.push({
          ...row,
          _originalIdx: originalIdx,
          _type: hasIndirect ? 'indirect' : 'direct',
          _isSplit: false
        });
      }
    });
    return separated;
  }, [editedPlxRows]);

  const filteredPlxRows = useMemo(() => {
    if (!plxSearch.trim()) return displayPlxRows;
    const searchLower = plxSearch.toLowerCase();
    return displayPlxRows.filter(row =>
      row.EID?.toLowerCase().includes(searchLower) ||
      row.Name?.toLowerCase().includes(searchLower)
    );
  }, [displayPlxRows, plxSearch]);

  const filteredComparison = useMemo(() => {
    if (!comparisonSearch.trim()) return comparison;
    const searchLower = comparisonSearch.toLowerCase();
    return comparison.filter(row =>
      row.EID?.toLowerCase().includes(searchLower) ||
      row.Name?.toLowerCase().includes(searchLower) ||
      row.Badge_Last3?.toLowerCase().includes(searchLower) ||
      row.Lines?.toLowerCase().includes(searchLower)
    );
  }, [comparison, comparisonSearch]);

  const mismatches = useMemo(() => {
    return comparison.filter(r => r.Status === 'Mismatch');
  }, [comparison]);

  // Smart recommendations
  const recommendations = useMemo(() => {
    const recs = [];

    // First, check for name-based badges that need matching
    editedCrescentRows.forEach(crescentRow => {
      if (crescentRow._isNameBased && crescentRow._extractedName) {
        const extractedName = crescentRow._extractedName.toLowerCase();

        // Find PLX records with matching or similar names
        plxForComparison.forEach(plxRecord => {
          if (!plxRecord.Name) return; // Skip if no name
          const plxLastName = plxRecord.Name.split(' ').pop()?.toLowerCase() || '';
          const plxFirstName = plxRecord.Name.split(' ')[0]?.toLowerCase() || '';
          const plxFullName = plxRecord.Name.toLowerCase();

          // Check if extracted name matches last name, first name, or is contained in full name
          if (plxLastName.includes(extractedName) ||
              extractedName.includes(plxLastName) ||
              plxFirstName.includes(extractedName) ||
              extractedName.includes(plxFirstName) ||
              plxFullName.includes(extractedName)) {

            // Check if this recommendation doesn't already exist
            const alreadyAdded = recs.some(r =>
              r.crescentEID === crescentRow.EID && r.plxEID === plxRecord.EID
            );

            if (!alreadyAdded) {
              recs.push({
                type: 'Name-Based Badge',
                crescentEID: crescentRow.EID,
                crescentBadge: crescentRow.FullBadges,
                crescentHours: crescentRow.Total_Hours,
                plxEID: plxRecord.EID,
                plxName: plxRecord.Name,
                plxHours: plxRecord.Total_Hours,
                reason: `Badge "${crescentRow.FullBadges}" contains name "${extractedName.toUpperCase()}" matching "${plxRecord.Name}"`
              });
            }
          }
        });
      }
    });

    mismatches.forEach(mismatch => {
      // Only look at records missing from one side
      if (mismatch.Total_Hours_Crescent === 0 || mismatch.Total_Hours_PLX === 0) {
        const crescentBadge = mismatch.FullBadges;
        const plxName = mismatch.Name.toLowerCase();
        const crescentEID = mismatch.EID;
        
        // Extract last 3 letters from badge
        const badgeLetters = crescentBadge.match(/[A-Za-z]{3}$/)?.[0]?.toLowerCase() || '';
        
        // Check all PLX records for potential matches
        plxForComparison.forEach(plxRecord => {
          const plxLastName = plxRecord.Name.split(' ').pop()?.toLowerCase() || '';
          const plxEID = plxRecord.EID;
          
          // Skip if EIDs match (already matched)
          if (plxEID === crescentEID) return;
          
          // Check if PLX name contains badge letters
          if (badgeLetters.length === 3 && plxLastName.includes(badgeLetters)) {
            recs.push({
              type: 'Name Match',
              crescentEID: crescentEID,
              crescentBadge: crescentBadge,
              crescentHours: mismatch.Total_Hours_Crescent,
              plxEID: plxEID,
              plxName: plxRecord.Name,
              plxHours: plxRecord.Total_Hours,
              reason: `Badge letters "${badgeLetters.toUpperCase()}" match last name "${plxLastName.toUpperCase()}"`
            });
          }
          
          // Check for EID digit differences (1 digit off)
          if (crescentEID.length === plxEID.length) {
            let diffCount = 0;
            for (let i = 0; i < crescentEID.length; i++) {
              if (crescentEID[i] !== plxEID[i]) diffCount++;
            }
            if (diffCount === 1) {
              recs.push({
                type: 'EID Typo',
                crescentEID: crescentEID,
                crescentBadge: crescentBadge,
                crescentHours: mismatch.Total_Hours_Crescent,
                plxEID: plxEID,
                plxName: plxRecord.Name,
                plxHours: plxRecord.Total_Hours,
                reason: `EID off by 1 digit: ${crescentEID} vs ${plxEID}`
              });
            }
          }
          
          // Check for missing/extra digit - improved pattern matching
          if (Math.abs(crescentEID.length - plxEID.length) === 1) {
            const shorter = crescentEID.length < plxEID.length ? crescentEID : plxEID;
            const longer = crescentEID.length > plxEID.length ? crescentEID : plxEID;
            if (longer.includes(shorter)) {
              recs.push({
                type: 'EID Length',
                crescentEID: crescentEID,
                crescentBadge: crescentBadge,
                crescentHours: mismatch.Total_Hours_Crescent,
                plxEID: plxEID,
                plxName: plxRecord.Name,
                plxHours: plxRecord.Total_Hours,
                reason: `Possible missing/extra digit: ${crescentEID} vs ${plxEID}`
              });
            }
          }
          
          // Check for multiple missing digits (like 189834447 vs 1898447)
          if (Math.abs(crescentEID.length - plxEID.length) >= 2) {
            const shorter = crescentEID.length < plxEID.length ? crescentEID : plxEID;
            const longer = crescentEID.length > plxEID.length ? crescentEID : plxEID;
            
            // Check if shorter is substring of longer
            if (longer.includes(shorter)) {
              recs.push({
                type: 'Multiple Digits',
                crescentEID: crescentEID,
                crescentBadge: crescentBadge,
                crescentHours: mismatch.Total_Hours_Crescent,
                plxEID: plxEID,
                plxName: plxRecord.Name,
                plxHours: plxRecord.Total_Hours,
                reason: `Missing ${Math.abs(crescentEID.length - plxEID.length)} digits: ${crescentEID} vs ${plxEID}`
              });
            }
            
            // Check for similar patterns (like 20684309 vs 206843309 - extra "3")
            let matchCount = 0;
            let j = 0;
            for (let i = 0; i < longer.length && j < shorter.length; i++) {
              if (longer[i] === shorter[j]) {
                matchCount++;
                j++;
              }
            }
            
            // If most digits match in sequence, it's likely a typo
            if (matchCount >= shorter.length - 1 && matchCount >= shorter.length * 0.8) {
              const alreadyAdded = recs.some(r => 
                r.crescentEID === crescentEID && r.plxEID === plxEID
              );
              if (!alreadyAdded) {
                recs.push({
                  type: 'Digit Pattern',
                  crescentEID: crescentEID,
                  crescentBadge: crescentBadge,
                  crescentHours: mismatch.Total_Hours_Crescent,
                  plxEID: plxEID,
                  plxName: plxRecord.Name,
                  plxHours: plxRecord.Total_Hours,
                  reason: `Similar digit pattern detected: ${crescentEID} vs ${plxEID}`
                });
              }
            }
          }
        });
      }
    });
    
    return recs;
  }, [mismatches, plxForComparison, editedCrescentRows]);

  const totalCrescent = useMemo(() => {
    return crescentProcessed.reduce((sum, r) => sum + (parseFloat(r.Total_Hours) || 0), 0);
  }, [crescentProcessed, refreshTrigger]);

  const totalCrescentDirect = useMemo(() => {
    return crescentProcessed.reduce((sum, r) => sum + (parseFloat(r.Direct_Hours) || 0), 0);
  }, [crescentProcessed, refreshTrigger]);

  const totalCrescentIndirect = useMemo(() => {
    return crescentProcessed.reduce((sum, r) => sum + (parseFloat(r.Indirect_Hours) || 0), 0);
  }, [crescentProcessed, refreshTrigger]);

  const totalPLX = useMemo(() => {
    return plxForComparison.reduce((sum, r) => sum + (parseFloat(r.Total_Hours) || 0), 0);
  }, [plxForComparison, refreshTrigger]);

  const totalPLXDirect = useMemo(() => {
    return plxForComparison.reduce((sum, r) => sum + (parseFloat(r.Direct_Hours) || 0), 0);
  }, [plxForComparison, refreshTrigger]);

  const totalPLXIndirect = useMemo(() => {
    return plxForComparison.reduce((sum, r) => sum + (parseFloat(r.Indirect_Hours) || 0), 0);
  }, [plxForComparison, refreshTrigger]);

  const totalDiff = Math.abs(totalCrescent - totalPLX);
  const totalsMatch = totalDiff < 0.01;

  const errorReportText = useMemo(() => {
    const checkedErrors = mismatches.filter(m => crescentErrors.has(m.EID));
    if (checkedErrors.length === 0) return '';

    // Helper function to convert "LAST, FIRST MIDDLE" to "First Middle Last"
    const formatName = (name) => {
      if (!name || !name.includes(',')) return name;
      const parts = name.split(',').map(p => p.trim());
      if (parts.length !== 2) return name;
      const [last, firstMiddle] = parts;
      // Convert to proper case (title case)
      const toTitleCase = (str) => str.toLowerCase().split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return `${toTitleCase(firstMiddle)} ${toTitleCase(last)}`;
    };

    // Helper function to format lines like "LINEG, LINEK" to "Line G/K"
    const formatLines = (lines) => {
      if (!lines) return '';
      const lineArray = lines.split(',').map(l => l.trim());
      const formatted = lineArray.map(line => {
        // Extract letter(s) after "LINE"
        const match = line.match(/LINE\s*([A-Z]+)/i);
        return match ? match[1].toUpperCase() : line;
      });
      return `Line ${formatted.join('/')}`;
    };

    // Helper function to format hours without unnecessary decimals
    const formatHours = (hours) => {
      const rounded = Math.round(hours * 100) / 100;
      return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
    };

    return checkedErrors.map((row, index) => {
      const badge = row.FullBadges ? row.FullBadges.split(', ')[0] : '';
      const formattedName = formatName(row.Name);
      const formattedLines = formatLines(row.Lines);
      const plxHours = formatHours(row.Total_Hours_PLX);
      const crescentHours = formatHours(row.Total_Hours_Crescent);

      // Only include badge line if there's actually a badge
      const badgeLine = badge ? `\n${badge}` : '';

      return `${index + 1}. ${formattedName} – worked on ${formattedLines} for ${plxHours} hours, not ${crescentHours} hours${badgeLine}`;
    }).join('\n\n');
  }, [mismatches, crescentErrors]);

  const handleFixRecommendation = (rec) => {
    // Update Crescent EID to match PLX EID
    const updatedRows = editedCrescentRows.map(row => {
      if (row.EID === rec.crescentEID) {
        // For name-based badges, we need to reconstruct the badge with the correct EID
        if (row._isNameBased) {
          // Extract the badge letters from the original badge
          const badgeLetters = row.FullBadges.match(/[A-Za-z]+$/)?.[0] || 'XXX';
          return {
            ...row,
            EID: rec.plxEID,
            FullBadges: `PLX-${rec.plxEID}-${badgeLetters}`,
            Badge_Last3: badgeLetters.slice(-3),
            _isNameBased: false,
            _extractedName: null
          };
        } else {
          // For numeric EID badges, use the original logic
          return {
            ...row,
            EID: rec.plxEID,
            FullBadges: row.FullBadges.replace(
              new RegExp(`PLX-${rec.crescentEID}-`, 'i'),
              `PLX-${rec.plxEID}-`
            ),
            Badge_Last3: row.FullBadges.replace(
              new RegExp(`PLX-${rec.crescentEID}-`, 'i'),
              `PLX-${rec.plxEID}-`
            ).slice(-3)
          };
        }
      }
      return row;
    });

    setEditedCrescentRows(updatedRows);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCopyReport = () => {
    // Use the fallback method which is more reliable
    const textArea = document.createElement('textarea');
    textArea.value = errorReportText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        alert('Error report copied to clipboard!');
      } else {
        alert('Failed to copy. Please manually select and copy the text.');
      }
    } catch (err) {
      document.body.removeChild(textArea);
      console.error('Failed to copy text: ', err);
      alert('Failed to copy. Please manually select and copy the text.');
    }
  };

  const handlePlxSync = (eid) => {
    // Find the Crescent record for this EID
    const crescentRecord = editedCrescentRows.find(r => r.EID === eid);
    if (!crescentRecord) return;

    // Find or create the PLX record for this EID
    const plxIndex = editedPlxRows.findIndex(r => r.EID === eid);

    if (plxIndex >= 0) {
      // Update existing PLX record
      const newRows = [...editedPlxRows];
      newRows[plxIndex] = {
        ...newRows[plxIndex],
        Total_Hours: crescentRecord.Total_Hours,
        Direct_Hours: crescentRecord.Direct_Hours,
        Indirect_Hours: crescentRecord.Indirect_Hours
      };
      setEditedPlxRows(newRows);
    } else {
      // Create new PLX record
      const newRow = {
        EID: eid,
        Name: crescentRecord.Name || '',
        Total_Hours: crescentRecord.Total_Hours,
        Direct_Hours: crescentRecord.Direct_Hours,
        Indirect_Hours: crescentRecord.Indirect_Hours
      };
      setEditedPlxRows([...editedPlxRows, newRow]);
    }

    setRefreshTrigger(prev => prev + 1);
  };

  const sortCrescentData = (column) => {
    const direction = crescentSort.column === column && crescentSort.direction === 'asc' ? 'desc' : 'asc';
    setCrescentSort({ column, direction });

    const sorted = [...editedCrescentRows].sort((a, b) => {
      let aVal, bVal;
      if (column === 'EID') {
        aVal = a.EID;
        bVal = b.EID;
      } else if (column === 'Badge') {
        aVal = a.Badge_Last3 || '';
        bVal = b.Badge_Last3 || '';
      } else if (column === 'Lines') {
        aVal = a.Lines || '';
        bVal = b.Lines || '';
      } else {
        aVal = a[column] || '';
        bVal = b[column] || '';
      }
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    setEditedCrescentRows(sorted);
  };

  const sortPlxData = (column) => {
    const direction = plxSort.column === column && plxSort.direction === 'asc' ? 'desc' : 'asc';
    setPlxSort({ column, direction });

    const sorted = [...editedPlxRows].sort((a, b) => {
      const aVal = column === 'EID' ? a.EID : a.Name;
      const bVal = column === 'EID' ? b.EID : b.Name;
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    setEditedPlxRows(sorted);
  };

  const handleExportRevisedPlx = () => {
    if (!plxData || editedPlxRows.length === 0) {
      alert('Please upload a PLX file first');
      return;
    }

    try {
      // Create new formatted workbook
      const workbook = XLSX.utils.book_new();

      // Create header row
      const headers = ['Dept', 'EID', 'Name', 'Hours'];
      const data = [headers];

      // Separate Direct and Indirect rows based on actual hours values
      const directRows = [];
      const indirectRows = [];

      editedPlxRows.forEach(row => {
        const directHours = parseFloat(row.Direct_Hours) || 0;
        const indirectHours = parseFloat(row.Indirect_Hours) || 0;

        // Add to Direct section if they have Direct hours
        if (directHours > 0) {
          // Use a Direct department code
          const directDept = row.Department ?
            row.Department.replace(/-251-221/, '-251-211') : '004-251-211';

          directRows.push({
            Department: directDept,
            EID: row.EID || '',
            Name: row.Name || '',
            Hours: directHours
          });
        }

        // Add to Indirect section if they have Indirect hours
        if (indirectHours > 0) {
          // Use an Indirect department code
          const indirectDept = row.Department ?
            row.Department.replace(/-251-211/, '-251-221') : '005-251-221';

          indirectRows.push({
            Department: indirectDept,
            EID: row.EID || '',
            Name: row.Name || '',
            Hours: indirectHours
          });
        }
      });

      // Add Direct section
      directRows.forEach(row => {
        data.push([
          row.Department,
          row.EID,
          row.Name,
          row.Hours.toFixed(2)
        ]);
      });

      // Calculate Direct summary
      const directHours = directRows.reduce((sum, row) => sum + row.Hours, 0);

      // Add blank row separator
      data.push([]);

      // Add Indirect section
      indirectRows.forEach(row => {
        data.push([
          row.Department,
          row.EID,
          row.Name,
          row.Hours.toFixed(2)
        ]);
      });

      // Calculate Indirect summary
      const indirectHours = indirectRows.reduce((sum, row) => sum + row.Hours, 0);

      // Add blank row before summary
      data.push([]);

      // Add summary section
      data.push(['Summary', '', '', '']);
      data.push(['Direct Associates:', directRows.length, 'Direct Hours:', directHours.toFixed(2)]);
      data.push(['Indirect Associates:', indirectRows.length, 'Indirect Hours:', indirectHours.toFixed(2)]);
      data.push(['Total Associates:', editedPlxRows.length, 'Total Hours:', (directHours + indirectHours).toFixed(2)]);

      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Set column widths for better formatting
      worksheet['!cols'] = [
        { wch: 20 },  // Dept
        { wch: 12 },  // EID
        { wch: 25 },  // Name
        { wch: 12 }   // Hours
      ];

      // Define border style
      const borderStyle = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      };

      // Define header style
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle
      };

      // Define data cell style
      const dataCellStyle = {
        border: borderStyle,
        alignment: { vertical: 'center' }
      };

      // Define summary header style
      const summaryHeaderStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '70AD47' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle
      };

      // Define summary cell style
      const summaryCellStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E2EFDA' } },
        border: borderStyle,
        alignment: { vertical: 'center' }
      };

      // Apply styles to all cells
      const range = XLSX.utils.decode_range(worksheet['!ref']);

      // Find summary row
      const summaryRowIdx = data.findIndex(row => row[0] === 'Summary');

      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;

          // Header row (first row)
          if (R === 0) {
            worksheet[cellAddress].s = headerStyle;
          }
          // Summary section
          else if (R >= summaryRowIdx && summaryRowIdx !== -1) {
            if (R === summaryRowIdx) {
              worksheet[cellAddress].s = summaryHeaderStyle;
            } else {
              worksheet[cellAddress].s = summaryCellStyle;
            }
          }
          // Data rows
          else if (data[R] && data[R].length > 0) {
            worksheet[cellAddress].s = dataCellStyle;

            // Right-align hours column
            if (C === 3 && !isNaN(parseFloat(data[R][C]))) {
              worksheet[cellAddress].s = {
                ...dataCellStyle,
                alignment: { horizontal: 'right', vertical: 'center' },
                numFmt: '0.00'
              };
            }
          }
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Revised PLX');

      // Export the file
      const fileName = `Revised_PLX_${selectedDay}_${selectedShift.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      alert('Revised PLX file exported successfully!');
    } catch (error) {
      console.error('Error exporting PLX file:', error);
      alert('Error exporting PLX file. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto bg-slate-50 min-h-screen">

      {/* ── Phase 1+2: Slim header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Labor Hours Comparison</h1>
            <p className="text-xs text-slate-400 mt-0.5">Compare ProLogistix and Crescent reports · identify discrepancies</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-mono">v1.4.2</span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">

        {/* ── Phase 2: Progress steps ── */}
        <div className="flex items-center">
          {[
            { n: 1, label: 'Upload Files', done: !!(plxFile && crescentFile), active: !plxFile || !crescentFile },
            { n: 2, label: 'Configure', done: !!(crescentProcessed.length > 0 && editedPlxRows.length > 0), active: !!(plxData && !(crescentProcessed.length > 0 && editedPlxRows.length > 0)) },
            { n: 3, label: 'Review & Export', done: false, active: !!(crescentProcessed.length > 0 && editedPlxRows.length > 0) }
          ].map((step, i) => (
            <React.Fragment key={step.n}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors flex-shrink-0 ${
                  step.done ? 'bg-blue-600 text-white' :
                  step.active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-1' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {step.done ? '✓' : step.n}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${step.done || step.active ? 'text-slate-700' : 'text-slate-400'}`}>{step.label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-3 ${step.done ? 'bg-blue-300' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Phase 2: Compact upload cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={`cursor-pointer bg-white border rounded-xl p-4 transition-all flex items-center gap-3 ${plxFile ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${plxFile ? 'bg-emerald-100' : 'bg-slate-100'}`}>
              {plxFile
                ? <CheckCircle size={18} className="text-emerald-600" />
                : <Upload size={18} className="text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700">PLX Report</div>
              <div className="text-xs text-slate-400 truncate mt-0.5">{plxFile ? plxFile.name : 'Excel (.xlsx, .xls)'}</div>
            </div>
            {plxFile && <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Loaded ✓</span>}
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => {
              const file = e.target.files[0];
              if (file) { setPlxFile(file); parsePLXFile(file); }
            }} />
          </label>

          <label className={`cursor-pointer bg-white border rounded-xl p-4 transition-all flex items-center gap-3 ${crescentFile ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${crescentFile ? 'bg-emerald-100' : 'bg-slate-100'}`}>
              {crescentFile
                ? <CheckCircle size={18} className="text-emerald-600" />
                : <Upload size={18} className="text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700">Crescent Report</div>
              <div className="text-xs text-slate-400 truncate mt-0.5">{crescentFile ? crescentFile.name : 'CSV or Excel (.csv, .xlsx, .xls)'}</div>
            </div>
            {crescentFile && <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Loaded ✓</span>}
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => {
              const file = e.target.files[0];
              if (file) { setCrescentFile(file); parseCrescentFile(file); }
            }} />
          </label>
        </div>

        {/* ── Phase 3: Sticky settings toolbar ── */}
        {plxData && (
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Day</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-slate-700"
              >
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Shift</span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-slate-700"
              >
                <option value="1st Shift">1st Shift</option>
                <option value="2nd Shift">2nd Shift</option>
              </select>
            </div>
            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <div className="flex-1" />
            <button
              onClick={handleExportRevisedPlx}
              disabled={!plxData || editedPlxRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export Revised PLX ↓
            </button>
          </div>
        )}

        {/* ── Phase 4: Metric strip ── */}
        {crescentProcessed.length > 0 && editedPlxRows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Crescent Total</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalCrescent.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">D {totalCrescentDirect.toFixed(2)} · I {totalCrescentIndirect.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">PLX Total</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalPLX.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">D {totalPLXDirect.toFixed(2)} · I {totalPLXIndirect.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Direct Hours</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalCrescentDirect.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Crescent</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Indirect Hours</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalCrescentIndirect.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Crescent</div>
            </div>
            <div className={`border rounded-xl px-4 py-3 ${totalsMatch ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide ${totalsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalsMatch ? 'Status' : 'Difference'}
              </div>
              <div className={`text-2xl font-bold mt-1 tabular-nums ${totalsMatch ? 'text-emerald-700' : 'text-red-600'}`}>
                {totalsMatch ? 'Match ✓' : `${totalDiff.toFixed(2)} hrs`}
              </div>
              <div className={`text-xs mt-0.5 ${totalsMatch ? 'text-emerald-500' : 'text-red-400'}`}>
                {totalsMatch ? 'Perfect alignment' : 'Hours off'}
              </div>
            </div>
          </div>
        )}

        {/* ── Phase 5: Unified detail tables ── */}
        {crescentProcessed.length > 0 && editedPlxRows.length > 0 && (
          <div className="space-y-4">

            {/* Crescent + PLX in one card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-200">

              {/* Crescent Detail */}
              <div>
                <button
                  onClick={() => setCrescentCollapsed(!crescentCollapsed)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-700">Crescent Detail</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{editedCrescentRows.length} records</span>
                  </div>
                  {crescentCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {!crescentCollapsed && (
                  <div className="px-5 pb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Search by EID, Badge, or Line…"
                        value={crescentSearch}
                        onChange={(e) => setCrescentSearch(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setEditedCrescentRows([...editedCrescentRows, { EID:'', Badge_Last3:'', FullBadges:'', Lines:'', Total_Hours:0, Direct_Hours:0, Indirect_Hours:0, ClockIn:'', ClockOut:'' }])}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        + Add Row
                      </button>
                    </div>
                    <div className="overflow-auto max-h-[500px] border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-3 text-left">
                              <button onClick={() => sortCrescentData('EID')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">
                                EID {crescentSort.column === 'EID' ? (crescentSort.direction === 'asc' ? ' ↑' : ' ↓') : <ArrowUpDown size={11} className="text-slate-300 ml-0.5" />}
                              </button>
                            </th>
                            <th className="p-3 text-left">
                              <button onClick={() => sortCrescentData('Badge')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">
                                Badge {crescentSort.column === 'Badge' ? (crescentSort.direction === 'asc' ? ' ↑' : ' ↓') : <ArrowUpDown size={11} className="text-slate-300 ml-0.5" />}
                              </button>
                            </th>
                            <th className="p-3 text-left">
                              <button onClick={() => sortCrescentData('Lines')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">
                                Lines {crescentSort.column === 'Lines' ? (crescentSort.direction === 'asc' ? ' ↑' : ' ↓') : <ArrowUpDown size={11} className="text-slate-300 ml-0.5" />}
                              </button>
                            </th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Direct</th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Indirect</th>
                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCrescentRows.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-sm text-slate-400">
                              {crescentSearch ? `No results for "${crescentSearch}"` : 'No records'}
                            </td></tr>
                          ) : filteredCrescentRows.map((row) => {
                            const originalIdx = row._originalIdx;
                            const isSplit = row._isSplit;
                            const isIndirect = row._type === 'indirect';
                            return (
                              <tr key={`${originalIdx}-${row._type}`} className={`hover:bg-slate-50 transition-colors ${isSplit ? 'bg-slate-50/60' : ''}`}>
                                <td className="p-2 pl-3">
                                  <input
                                    type="text"
                                    value={row.EID}
                                    onChange={(e) => {
                                      const newRows = [...editedCrescentRows];
                                      const newEID = e.target.value;
                                      newRows[originalIdx].EID = newEID;
                                      if (newEID && newRows[originalIdx].Badge_Last3) {
                                        if (newEID.startsWith('NAME_') || newEID.startsWith('UNRECOGNIZED_')) {
                                          newRows[originalIdx].FullBadges = `PLX-${newRows[originalIdx].Badge_Last3}`;
                                        } else {
                                          newRows[originalIdx].FullBadges = `PLX-${newEID}-${newRows[originalIdx].Badge_Last3}`;
                                        }
                                      }
                                      setEditedCrescentRows(newRows);
                                    }}
                                    className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm transition-colors ${isSplit ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={row.Badge_Last3}
                                    onChange={(e) => {
                                      const newRows = [...editedCrescentRows];
                                      const newLast3 = e.target.value.toUpperCase();
                                      newRows[originalIdx].Badge_Last3 = newLast3;
                                      if (newRows[originalIdx].EID && newLast3) {
                                        if (newRows[originalIdx].EID.startsWith('NAME_') || newRows[originalIdx].EID.startsWith('UNRECOGNIZED_')) {
                                          newRows[originalIdx].FullBadges = `PLX-${newLast3}`;
                                        } else {
                                          newRows[originalIdx].FullBadges = `PLX-${newRows[originalIdx].EID}-${newLast3}`;
                                        }
                                      } else if (newRows[originalIdx].FullBadges) {
                                        const badgeBase = newRows[originalIdx].FullBadges.slice(0, -3);
                                        newRows[originalIdx].FullBadges = badgeBase + newLast3;
                                      }
                                      setEditedCrescentRows(newRows);
                                    }}
                                    title={row.FullBadges}
                                    className={`w-14 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-xs uppercase transition-colors ${isSplit ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    placeholder="ABC"
                                    maxLength="3"
                                    disabled={isSplit}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={row.Lines}
                                    onChange={(e) => {
                                      const newRows = [...editedCrescentRows];
                                      newRows[originalIdx].Lines = e.target.value;
                                      setEditedCrescentRows(newRows);
                                    }}
                                    className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-xs transition-colors ${isSplit ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    placeholder="e.g., LINEG, LINEK"
                                    disabled={isSplit}
                                  />
                                </td>
                                <td className="p-2 text-right text-sm font-medium text-slate-700 tabular-nums">{row.Total_Hours.toFixed(2)}</td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.Direct_Hours}
                                    onChange={(e) => {
                                      const newRows = [...editedCrescentRows];
                                      const newValue = parseFloat(e.target.value) || 0;
                                      newRows[originalIdx].Direct_Hours = newValue;
                                      newRows[originalIdx].Total_Hours = newValue + newRows[originalIdx].Indirect_Hours;
                                      setEditedCrescentRows(newRows);
                                    }}
                                    className={`w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm tabular-nums transition-colors ${(isSplit && !isIndirect) ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit && !isIndirect}
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.Indirect_Hours}
                                    onChange={(e) => {
                                      const newRows = [...editedCrescentRows];
                                      const newValue = parseFloat(e.target.value) || 0;
                                      newRows[originalIdx].Indirect_Hours = newValue;
                                      newRows[originalIdx].Total_Hours = newValue + newRows[originalIdx].Direct_Hours;
                                      setEditedCrescentRows(newRows);
                                    }}
                                    className={`w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm tabular-nums transition-colors ${(isSplit && isIndirect) ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit && isIndirect}
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => setEditedCrescentRows(editedCrescentRows.filter((_, i) => i !== originalIdx))}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* PLX Detail */}
              <div>
                <button
                  onClick={() => setPlxCollapsed(!plxCollapsed)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-700">PLX Detail</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{editedPlxRows.length} records</span>
                    <span className="text-xs text-slate-400">{selectedDay} · {selectedShift}</span>
                  </div>
                  {plxCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {!plxCollapsed && (
                  <div className="px-5 pb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Search by EID or Name…"
                        value={plxSearch}
                        onChange={(e) => setPlxSearch(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setEditedPlxRows([...editedPlxRows, { EID:'', Name:'', Total_Hours:0, OT_Hours:0, Direct_Hours:0, Indirect_Hours:0 }])}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        + Add Row
                      </button>
                    </div>
                    <div className="overflow-auto max-h-[500px] border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-3 text-left">
                              <button onClick={() => sortPlxData('EID')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">
                                EID {plxSort.column === 'EID' ? (plxSort.direction === 'asc' ? ' ↑' : ' ↓') : <ArrowUpDown size={11} className="text-slate-300 ml-0.5" />}
                              </button>
                            </th>
                            <th className="p-3 text-left">
                              <button onClick={() => sortPlxData('Name')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">
                                Name {plxSort.column === 'Name' ? (plxSort.direction === 'asc' ? ' ↑' : ' ↓') : <ArrowUpDown size={11} className="text-slate-300 ml-0.5" />}
                              </button>
                            </th>
                            <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Dept</th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              <span className="inline-flex items-center gap-1">OT <span className="text-orange-400 font-medium bg-orange-50 px-1 rounded normal-case tracking-normal text-[10px]">sub</span></span>
                            </th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Direct</th>
                            <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Indirect</th>
                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPlxRows.length === 0 ? (
                            <tr><td colSpan="8" className="p-8 text-center text-sm text-slate-400">
                              {plxSearch ? `No results for "${plxSearch}"` : 'No records'}
                            </td></tr>
                          ) : filteredPlxRows.map((row) => {
                            const originalIdx = row._originalIdx;
                            const isSplit = row._isSplit;
                            const isIndirect = row._type === 'indirect';
                            return (
                              <tr key={`${originalIdx}-${row._type}`} className={`hover:bg-slate-50 transition-colors ${isSplit ? 'bg-slate-50/60' : ''}`}>
                                <td className="p-2 pl-3">
                                  <input
                                    type="text"
                                    value={row.EID}
                                    onChange={(e) => {
                                      const newRows = [...editedPlxRows];
                                      newRows[originalIdx].EID = e.target.value;
                                      setEditedPlxRows(newRows);
                                    }}
                                    className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm transition-colors ${isSplit ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={row.Name}
                                    onChange={(e) => {
                                      const newRows = [...editedPlxRows];
                                      newRows[originalIdx].Name = e.target.value;
                                      setEditedPlxRows(newRows);
                                    }}
                                    className={`w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm transition-colors ${isSplit ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit}
                                  />
                                </td>
                                <td className="p-2">
                                  <span className="text-xs text-slate-500 truncate block max-w-[140px]" title={row.Department}>{row.Department || '—'}</span>
                                </td>
                                <td className="p-2 text-right text-sm font-medium text-slate-700 tabular-nums">{row.Total_Hours.toFixed(2)}</td>
                                <td className="p-2 text-right tabular-nums">
                                  <span className={`text-sm ${(row.OT_Hours || 0) > 0 ? 'text-orange-500 font-semibold' : 'text-slate-300'}`}>
                                    {(row.OT_Hours || 0).toFixed(2)}
                                  </span>
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.Direct_Hours}
                                    onChange={(e) => {
                                      const newRows = [...editedPlxRows];
                                      const newValue = parseFloat(e.target.value) || 0;
                                      newRows[originalIdx].Direct_Hours = newValue;
                                      newRows[originalIdx].Total_Hours = newValue + newRows[originalIdx].Indirect_Hours;
                                      setEditedPlxRows(newRows);
                                    }}
                                    className={`w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm tabular-nums transition-colors ${(isSplit && !isIndirect) ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit && !isIndirect}
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.Indirect_Hours}
                                    onChange={(e) => {
                                      const newRows = [...editedPlxRows];
                                      const newValue = parseFloat(e.target.value) || 0;
                                      newRows[originalIdx].Indirect_Hours = newValue;
                                      newRows[originalIdx].Total_Hours = newValue + newRows[originalIdx].Direct_Hours;
                                      setEditedPlxRows(newRows);
                                    }}
                                    className={`w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm tabular-nums transition-colors ${(isSplit && isIndirect) ? 'text-slate-400 cursor-default' : 'text-slate-700'}`}
                                    disabled={isSplit && isIndirect}
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => setEditedPlxRows(editedPlxRows.filter((_, i) => i !== originalIdx))}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>{/* end unified card */}

            {/* ── Phase 6: Smart Recommendations ── */}
            {recommendations.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 flex items-center gap-3 bg-amber-50/50 border-b border-amber-100">
                  <Lightbulb className="text-amber-500 flex-shrink-0" size={16} />
                  <span className="text-sm font-semibold text-slate-700">Smart Recommendations</span>
                  <span className="text-xs text-slate-400">· {recommendations.length} suggestion{recommendations.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-slate-400 ml-auto hidden md:block">Possible badge matches detected based on names and EID patterns</span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Crescent</th>
                        <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">C Hrs</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">PLX</th>
                        <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">P Hrs</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</th>
                        <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recommendations.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              (rec.type === 'Name-Based Badge' || rec.type === 'Name Match')
                                ? 'bg-purple-50 text-purple-700'
                                : (rec.type === 'EID Typo' || rec.type === 'Multiple Digits' || rec.type === 'Digit Pattern')
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {rec.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{rec.crescentEID}</div>
                            <div className="text-xs text-slate-400">{rec.crescentBadge}</div>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700 tabular-nums">{rec.crescentHours.toFixed(2)}</td>
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{rec.plxEID}</div>
                            <div className="text-xs text-slate-400">{rec.plxName}</div>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700 tabular-nums">{rec.plxHours.toFixed(2)}</td>
                          <td className="p-3 text-xs text-slate-500">{rec.reason}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleFixRecommendation(rec)}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md text-xs font-medium transition-colors"
                            >
                              ✓ Apply
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Phase 7: Comparison Summary ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <button
                onClick={() => setComparisonCollapsed(!comparisonCollapsed)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-slate-700">Comparison Summary</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{comparison.length} records</span>
                  {mismatches.length > 0 && (
                    <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full">
                      {mismatches.length} mismatch{mismatches.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
                {comparisonCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {!comparisonCollapsed && (
                <div className="px-5 pb-5 border-t border-slate-200">
                  <div className="pt-3 mb-3">
                    <input
                      type="text"
                      placeholder="Search by EID, Name, Badge, or Line…"
                      value={comparisonSearch}
                      onChange={(e) => setComparisonSearch(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="overflow-auto border border-slate-200 rounded-lg max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">EID</th>
                          <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                          <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lines</th>
                          <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Crescent</th>
                          <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">PLX</th>
                          <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredComparison.length === 0 ? (
                          <tr><td colSpan="6" className="p-8 text-center text-sm text-slate-400">
                            {comparisonSearch ? `No results for "${comparisonSearch}"` : 'No records'}
                          </td></tr>
                        ) : filteredComparison.map((row, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.Status === 'Mismatch' ? 'bg-red-50/40' : ''}`}>
                            <td className={`p-3 text-slate-700 ${row.Status === 'Mismatch' ? 'border-l-2 border-l-red-400' : ''}`}>{row.EID}</td>
                            <td className="p-3 text-slate-700">{row.Name}</td>
                            <td className="p-3 text-slate-500">{row.Lines || '—'}</td>
                            <td className="p-3 text-right text-slate-700 tabular-nums">{row.Total_Hours_Crescent.toFixed(2)}</td>
                            <td className="p-3 text-right text-slate-700 tabular-nums">{row.Total_Hours_PLX.toFixed(2)}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.Status === 'Match' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className={`text-xs font-medium ${row.Status === 'Match' ? 'text-emerald-600' : 'text-red-500'}`}>{row.Status}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Phase 7: Discrepancies ── */}
            {mismatches.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" style={{borderLeft: '4px solid #f87171'}}>
                <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-200">
                  <AlertCircle className="text-red-400 flex-shrink-0" size={16} />
                  <span className="text-sm font-semibold text-slate-700">Discrepancies</span>
                  <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full">{mismatches.length}</span>
                  <span className="text-xs text-slate-400 ml-1">Review and mark Crescent errors to generate report</span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Error</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">EID</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                        <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Crescent</th>
                        <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">PLX</th>
                        <th className="p-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Diff</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                        <th className="p-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mismatches.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={crescentErrors.has(row.EID)}
                              onChange={(e) => {
                                const newErrors = new Set(crescentErrors);
                                if (e.target.checked) { newErrors.add(row.EID); } else { newErrors.delete(row.EID); }
                                setCrescentErrors(newErrors);
                              }}
                              className="w-4 h-4 cursor-pointer accent-red-500"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.EID}
                              onChange={(e) => {
                                const oldEID = row.EID;
                                const newEID = e.target.value;
                                const updatedCrescent = editedCrescentRows.map(r => {
                                  if (r.EID === oldEID && row.Total_Hours_Crescent > 0) {
                                    return {
                                      ...r,
                                      EID: newEID,
                                      FullBadges: r.FullBadges.replace(new RegExp(`PLX-${oldEID}-`, 'i'), `PLX-${newEID}-`),
                                      Badge_Last3: r.FullBadges.replace(new RegExp(`PLX-${oldEID}-`, 'i'), `PLX-${newEID}-`).slice(-3)
                                    };
                                  }
                                  return r;
                                });
                                const updatedPlx = editedPlxRows.map(r => r.EID === oldEID && row.Total_Hours_PLX > 0 ? { ...r, EID: newEID } : r);
                                setEditedCrescentRows(updatedCrescent);
                                setEditedPlxRows(updatedPlx);
                                setTimeout(() => setRefreshTrigger(prev => prev + 1), 100);
                              }}
                              className="w-24 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-sm font-medium text-slate-700 transition-colors"
                            />
                          </td>
                          <td className="p-3 text-slate-700">
                            {row.Name || <span className="text-slate-400 italic">{row.FullBadges?.match(/[A-Za-z]{3}$/)?.[0] || 'N/A'}</span>}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700 tabular-nums">{row.Total_Hours_Crescent.toFixed(2)}</td>
                          <td className="p-3 text-right font-medium text-slate-700 tabular-nums">{row.Total_Hours_PLX.toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-red-500 tabular-nums">{Math.abs(row.Total_Hours_Crescent - row.Total_Hours_PLX).toFixed(2)}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={mismatchNotes[row.EID] || ''}
                              onChange={(e) => setMismatchNotes(prev => ({ ...prev, [row.EID]: e.target.value }))}
                              placeholder="Add notes…"
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-0 py-0.5 text-xs text-slate-600 placeholder-slate-300 transition-colors"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handlePlxSync(row.EID)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                              title="Sync PLX hours to match Crescent"
                            >
                              <ArrowLeftRight size={11} />
                              Sync Hours
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Phase 7+8: Dark error report block ── */}
                {errorReportText && (
                  <div className="mx-5 mb-5 mt-4">
                    <div className="bg-slate-900 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Error Report for Client</span>
                        <button
                          onClick={handleCopyReport}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-xs font-medium transition-colors"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      </div>
                      <pre className="px-4 py-4 whitespace-pre-wrap text-xs text-slate-200 font-mono leading-relaxed max-h-64 overflow-auto">
                        {errorReportText}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

// Render the app
ReactDOM.render(<PLXCrescentCompare />, document.getElementById('root'));
