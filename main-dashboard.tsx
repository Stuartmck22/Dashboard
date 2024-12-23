import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Papa from 'papaparse';

// Shared utility functions and props
const getBarFill = (value) => value < 0 ? '#666' : '#ff6b00';

const commonChartProps = {
  margin: { top: 40, right: 30, left: 20, bottom: 70 },
  height: 400
};

const commonXAxisProps = {
  dataKey: "Name",
  angle: -45,
  textAnchor: "end",
  interval: 0,
  height: 70,
  fontSize: 12
};

const commonYAxisProps = {
  label: { 
    position: 'top',
    offset: 20,
    fontSize: 14
  }
};

// Test dashboard components
const CMJDashboard = () => {
  const [data, setData] = useState({
    cmjHeight: [],
    powerToWeight: [],
    singleLeg: [],
    asymmetry: []
  });
  
  const [averages, setAverages] = useState({
    cmjHeight: 0,
    powerToWeight: 0,
    leftJumpHeight: 0,
    rightJumpHeight: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('CMJ tab_Athlete_Test_Summary.csv', { encoding: 'utf8' });
        const parsedData = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        const cleanData = parsedData.filter(row => row['CMJ Jump Height (cm)'] !== null);

        cleanData.forEach(row => {
          if (row['SLCMJ Asymmetry (%)']) {
            const value = parseFloat(row['SLCMJ Asymmetry (%)']);
            const direction = row['SLCMJ Asymmetry (%)'].includes('L') ? -1 : 1;
            row['SLCMJ Asymmetry Value'] = value * direction;
          }
        });

        const dataSorted = {
          cmjHeight: [...cleanData].sort((a, b) => b['CMJ Jump Height (cm)'] - a['CMJ Jump Height (cm)']),
          powerToWeight: [...cleanData].sort((a, b) => b['CMJ Peak Power (W/kg)'] - a['CMJ Peak Power (W/kg)']),
          singleLeg: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['SLCMJ Jump Height (L) (cm)'], a['SLCMJ Jump Height (R) (cm)']);
            const maxB = Math.max(b['SLCMJ Jump Height (L) (cm)'], b['SLCMJ Jump Height (R) (cm)']);
            return maxB - maxA;
          }),
          asymmetry: [...cleanData].sort((a, b) => Math.abs(b['SLCMJ Asymmetry Value'] || 0) - Math.abs(a['SLCMJ Asymmetry Value'] || 0))
        };

        const avgValues = {
          cmjHeight: cleanData.reduce((sum, row) => sum + row['CMJ Jump Height (cm)'], 0) / cleanData.length,
          powerToWeight: cleanData.reduce((sum, row) => sum + row['CMJ Peak Power (W/kg)'], 0) / cleanData.length,
          leftJumpHeight: cleanData.reduce((sum, row) => sum + row['SLCMJ Jump Height (L) (cm)'], 0) / cleanData.length,
          rightJumpHeight: cleanData.reduce((sum, row) => sum + row['SLCMJ Jump Height (R) (cm)'], 0) / cleanData.length
        };

        setData(dataSorted);
        setAverages(avgValues);
      } catch (error) {
        console.error('Error loading CMJ data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Countermovement Jump (CMJ) Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            The CMJ test evaluates lower-body power and asymmetry, crucial for explosive movements in Camogie. 
            Benchmarks: Jump Height (25-35cm average, 35+ high performers), Power-to-Weight (30-40 W/kg average, 40+ high performers).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Bilateral Jump Height (cm)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.cmjHeight} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Height (cm)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="CMJ Jump Height (cm)" fill="#ff6b00" name="Jump Height" />
              <ReferenceLine y={averages.cmjHeight} stroke="#666" strokeDasharray="3 3" label="Group Average" />
              <ReferenceLine y={35} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (35+ cm)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={25} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (25 cm)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Power-to-Weight Ratio (W/kg)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.powerToWeight} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Power (W/kg)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="CMJ Peak Power (W/kg)" fill="#ff6b00" name="Power-to-Weight" />
              <ReferenceLine y={averages.powerToWeight} stroke="#666" strokeDasharray="3 3" label="Group Average" />
              <ReferenceLine y={40} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (40+ W/kg)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={30} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (30 W/kg)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Single-Leg CMJ Height (cm)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.singleLeg} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Height (cm)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="SLCMJ Jump Height (L) (cm)" fill="#ff6b00" name="Left Leg" />
              <Bar dataKey="SLCMJ Jump Height (R) (cm)" fill="#666" name="Right Leg" />
              <ReferenceLine y={averages.leftJumpHeight} stroke="#666" strokeDasharray="3 3" label="Group Average" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Single-Leg CMJ Asymmetry (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.asymmetry} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'Asymmetry (%)' }}
                tickFormatter={(value) => `${Math.abs(value)}% ${value < 0 ? 'Left' : 'Right'}`}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={10} stroke="#dc2626" strokeWidth={2} label={{ value: '10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#dc2626" strokeWidth={2} label={{ value: '-10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar 
                dataKey="SLCMJ Asymmetry Value" 
                name="Asymmetry"
                fill="#ff6b00"
                style={({ payload }) => ({
                  fill: getBarFill(payload?.['SLCMJ Asymmetry Value'])
                })}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
const CMRJDashboard = () => {
  const [data, setData] = useState({
    firstJump: [],
    reboundJump: [],
    contactTime: [],
    singleLeg: [],
    asymmetry: []
  });
  
  const [averages, setAverages] = useState({
    firstJumpHeight: 0,
    reboundHeight: 0,
    contactTime: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('CMRJ Unique_Athlete_Metrics.csv', { encoding: 'utf8' });
        const parsedData = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        const cleanData = parsedData.filter(row => row['CMRJ First Jump Height (cm)'] !== null);

        cleanData.forEach(row => {
          if (row['SLCMJ Asymmetry (%)']) {
            const value = parseFloat(row['SLCMJ Asymmetry (%)']);
            const direction = row['SLCMJ Asymmetry (%)'].includes('L') ? -1 : 1;
            row['SLCMJ Asymmetry Value'] = value * direction;
          }
        });

        const dataSorted = {
          firstJump: [...cleanData].sort((a, b) => b['CMRJ First Jump Height (cm)'] - a['CMRJ First Jump Height (cm)']),
          reboundJump: [...cleanData].sort((a, b) => b['CMRJ Rebound Jump Height (cm)'] - a['CMRJ Rebound Jump Height (cm)']),
          contactTime: [...cleanData].sort((a, b) => a['CMRJ Rebound Contact Time (ms)'] - b['CMRJ Rebound Contact Time (ms)']),
          singleLeg: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['SLCMJ Jump Height (L) (cm)'], a['SLCMJ Jump Height (R) (cm)']);
            const maxB = Math.max(b['SLCMJ Jump Height (L) (cm)'], b['SLCMJ Jump Height (R) (cm)']);
            return maxB - maxA;
          }),
          asymmetry: [...cleanData].sort((a, b) => 
            Math.abs(a['SLCMJ Asymmetry Value']) - Math.abs(b['SLCMJ Asymmetry Value'])
          )
        };

        const avgValues = {
          firstJumpHeight: cleanData.reduce((sum, row) => sum + row['CMRJ First Jump Height (cm)'], 0) / cleanData.length,
          reboundHeight: cleanData.reduce((sum, row) => sum + row['CMRJ Rebound Jump Height (cm)'], 0) / cleanData.length,
          contactTime: cleanData.reduce((sum, row) => sum + row['CMRJ Rebound Contact Time (ms)'], 0) / cleanData.length
        };

        setData(dataSorted);
        setAverages(avgValues);
      } catch (error) {
        console.error('Error loading CMRJ data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Countermovement Rebound Jump (CMRJ) Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            The CMRJ test measures reactive strength and contact times for quick, dynamic movements during gameplay. 
            This assessment helps evaluate an athlete's ability to quickly transition between landing and takeoff movements.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">CMRJ First Jump Height (cm)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.firstJump} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Height (cm)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="CMRJ First Jump Height (cm)" fill="#ff6b00" name="First Jump Height" />
              <ReferenceLine y={averages.firstJumpHeight} stroke="#666" strokeDasharray="3 3" label="Group Average" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">CMRJ Rebound Jump Height (cm)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.reboundJump} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Height (cm)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="CMRJ Rebound Jump Height (cm)" fill="#ff6b00" name="Rebound Height" />
              <ReferenceLine y={averages.reboundHeight} stroke="#666" strokeDasharray="3 3" label="Group Average" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">CMRJ Contact Time (ms)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.contactTime} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Time (ms)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="CMRJ Rebound Contact Time (ms)" fill="#ff6b00" name="Contact Time" />
              <ReferenceLine y={averages.contactTime} stroke="#666" strokeDasharray="3 3" label="Group Average" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Single-Leg CMRJ Height (cm)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.singleLeg} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Height (cm)' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="SLCMJ Jump Height (L) (cm)" fill="#ff6b00" name="Left Leg" />
              <Bar dataKey="SLCMJ Jump Height (R) (cm)" fill="#666" name="Right Leg" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Single-Leg CMRJ Asymmetry (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.asymmetry} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'Asymmetry (%)' }}
                tickFormatter={(value) => `${Math.abs(value)}% ${value < 0 ? 'Left' : 'Right'}`}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={10} stroke="#dc2626" strokeWidth={2} label={{ value: '10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#dc2626" strokeWidth={2} label={{ value: '-10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar 
                dataKey="SLCMJ Asymmetry Value" 
                name="Asymmetry"
                fill="#ff6b00"
                style={({ payload }) => ({
                  fill: getBarFill(payload?.['SLCMJ Asymmetry Value'])
                })}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
const HopTestDashboard = () => {
  const [data, setData] = useState([]);
  const [average, setAverage] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('Athlete_RSI_Scores.csv', { encoding: 'utf8' });
        const parsedData = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        // Filter out null values and sort by RSI
        const cleanData = parsedData
          .filter(row => row.RSI !== null)
          .sort((a, b) => b.RSI - a.RSI);

        // Calculate average
        const avg = cleanData.reduce((sum, row) => sum + row.RSI, 0) / cleanData.length;

        setData(cleanData);
        setAverage(avg);
      } catch (error) {
        console.error('Error loading RSI data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hop Test - Reactive Strength Index (RSI)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            The RSI measures elastic strength and force efficiency during jumps. 
            Benchmarks: 1.5–2.5 (average performance), 2.5+ (high performance).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">RSI Scores</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'RSI Score' }}
                domain={[0, 'auto']}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="RSI" fill="#ff6b00" name="RSI Score" />
              <ReferenceLine y={average} stroke="#666" strokeDasharray="3 3" label="Group Average" />
              <ReferenceLine 
                y={2.5} 
                stroke="#22c55e" 
                strokeWidth={2}
                label={{ 
                  value: 'High Performance (2.5+)', 
                  position: 'right',
                  fill: '#22c55e',
                  fontSize: 12
                }} 
              />
              <ReferenceLine 
                y={1.5} 
                stroke="#dc2626" 
                strokeWidth={2}
                label={{ 
                  value: 'Minimum Target (1.5)', 
                  position: 'right',
                  fill: '#dc2626',
                  fontSize: 12
                }} 
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
const HipStrengthDashboard = () => {
  const [data, setData] = useState({
    strength: [],
    imbalance: [],
    ratio: []
  });
  
  const [averages, setAverages] = useState({
    abductionL: 0,
    abductionR: 0,
    adductionL: 0,
    adductionR: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('Hip_Strength_Profile_Cleaned.csv', { encoding: 'utf8' });
        const parsedData = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        const cleanData = parsedData.filter(row => row['Hip Abduction L'] !== null);

        cleanData.forEach(row => {
          if (row['Hip Max Imbalance (%)']) {
            const value = parseFloat(row['Hip Max Imbalance (%)']);
            const direction = row['Hip Max Imbalance (%)'].includes('L') ? -1 : 1;
            row['Hip Max Imbalance Value'] = value * direction;
          }
        });

        const dataSorted = {
          strength: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['Hip Adduction L'], a['Hip Adduction R']);
            const maxB = Math.max(b['Hip Adduction L'], b['Hip Adduction R']);
            return maxB - maxA;
          }),
          imbalance: [...cleanData].sort((a, b) => 
            Math.abs(a['Hip Max Imbalance Value']) - Math.abs(b['Hip Max Imbalance Value'])
          ),
          ratio: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['Max Ratio L'], a['Max Ratio R']);
            const maxB = Math.max(b['Max Ratio L'], b['Max Ratio R']);
            return maxB - maxA;
          })
        };

        const avgValues = {
          abductionL: cleanData.reduce((sum, row) => sum + row['Hip Abduction L'], 0) / cleanData.length,
          abductionR: cleanData.reduce((sum, row) => sum + row['Hip Abduction R'], 0) / cleanData.length,
          adductionL: cleanData.reduce((sum, row) => sum + row['Hip Adduction L'], 0) / cleanData.length,
          adductionR: cleanData.reduce((sum, row) => sum + row['Hip Adduction R'], 0) / cleanData.length
        };

        setData(dataSorted);
        setAverages(avgValues);
      } catch (error) {
        console.error('Error loading hip strength data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hip Strength Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            Hip strength assessment evaluates hip stability, abduction, and adduction strength for injury prevention and agility.
            Benchmarks: Adduction (150-245N avg, 245N+ high), Abduction (120-210N avg, 210N+ high), Ratio (1.0-1.3 ideal).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hip Abduction Strength (N)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.strength} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Force (N)' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={210} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (210N+)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={120} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (120N)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar dataKey="Hip Abduction L" fill="#ff6b00" name="Left" />
              <Bar dataKey="Hip Abduction R" fill="#666" name="Right" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hip Adduction Strength (N)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.strength} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Force (N)' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={245} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (245N+)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={150} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (150N)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar dataKey="Hip Adduction L" fill="#ff6b00" name="Left" />
              <Bar dataKey="Hip Adduction R" fill="#666" name="Right" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hip Strength Imbalance (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.imbalance} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'Imbalance (%)' }}
                tickFormatter={(value) => `${Math.abs(value)}% ${value < 0 ? 'Left' : 'Right'}`}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={10} stroke="#dc2626" strokeWidth={2} label={{ value: '10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#dc2626" strokeWidth={2} label={{ value: '-10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar 
                dataKey="Hip Max Imbalance Value" 
                name="Imbalance"
                fill="#ff6b00"
                style={({ payload }) => ({
                  fill: getBarFill(payload?.['Hip Max Imbalance Value'])
                })}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Adduction-to-Abduction Ratio</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.ratio} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Ratio' }} domain={[0, 'auto']} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={1.3} stroke="#dc2626" strokeWidth={2} label={{ value: 'Upper Target (1.3)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={1.0} stroke="#dc2626" strokeWidth={2} label={{ value: 'Lower Target (1.0)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar dataKey="Max Ratio L" fill="#ff6b00" name="Left" />
              <Bar dataKey="Max Ratio R" fill="#666" name="Right" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

// Hamstring Dashboard Component
const HamstringDashboard = () => {
  const [data, setData] = useState({
    nordic: [],
    nordicImbalance: [],
    isoProne: [],
    isoProneImbalance: []
  });
  
  const [averages, setAverages] = useState({
    nordicL: 0,
    nordicR: 0,
    isoProneL: 0,
    isoProneR: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('NordBord_Strength_Profile_Updated.csv', { encoding: 'utf8' });
        const parsedData = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        const cleanData = parsedData.filter(row => row['Nordic Max Force L'] !== null);

        // Process imbalances
        cleanData.forEach(row => {
          if (row['Nordic Max Imbalance (%)']) {
            const value = parseFloat(row['Nordic Max Imbalance (%)']);
            const direction = row['Nordic Max Imbalance (%)'].includes('L') ? -1 : 1;
            row['Nordic Max Imbalance Value'] = value * direction;
          }
          if (row['ISO Prone Max Imbalance (%)']) {
            const value = parseFloat(row['ISO Prone Max Imbalance (%)']);
            const direction = row['ISO Prone Max Imbalance (%)'].includes('L') ? -1 : 1;
            row['ISO Prone Max Imbalance Value'] = value * direction;
          }
        });

        // Create sorted datasets
        const dataSorted = {
          nordic: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['Nordic Max Force L'], a['Nordic Max Force R']);
            const maxB = Math.max(b['Nordic Max Force L'], b['Nordic Max Force R']);
            return maxB - maxA;
          }),
          nordicImbalance: [...cleanData].sort((a, b) => 
            Math.abs(a['Nordic Max Imbalance Value']) - Math.abs(b['Nordic Max Imbalance Value'])
          ),
          isoProne: [...cleanData].sort((a, b) => {
            const maxA = Math.max(a['ISO Prone Max Force L'], a['ISO Prone Max Force R']);
            const maxB = Math.max(b['ISO Prone Max Force L'], b['ISO Prone Max Force R']);
            return maxB - maxA;
          }),
          isoProneImbalance: [...cleanData].sort((a, b) => 
            Math.abs(a['ISO Prone Max Imbalance Value']) - Math.abs(b['ISO Prone Max Imbalance Value'])
          )
        };

        // Calculate averages
        const avgValues = {
          nordicL: cleanData.reduce((sum, row) => sum + row['Nordic Max Force L'], 0) / cleanData.length,
          nordicR: cleanData.reduce((sum, row) => sum + row['Nordic Max Force R'], 0) / cleanData.length,
          isoProneL: cleanData.reduce((sum, row) => sum + row['ISO Prone Max Force L'], 0) / cleanData.length,
          isoProneR: cleanData.reduce((sum, row) => sum + row['ISO Prone Max Force R'], 0) / cleanData.length
        };

        setData(dataSorted);
        setAverages(avgValues);
      } catch (error) {
        console.error('Error loading hamstring data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Hamstring Strength Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            Measures hamstring strength and symmetry to assess injury risk and sprint performance.
            Benchmarks: Nordic Force (210-315N avg, 315N+ high), Isometric Prone Force (180-280N avg, 280N+ high).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Nordic Force (N)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.nordic} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Force (N)' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={315} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (315N+)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={210} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (210N)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar dataKey="Nordic Max Force L" fill="#ff6b00" name="Left" />
              <Bar dataKey="Nordic Max Force R" fill="#666" name="Right" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Nordic Asymmetry (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.nordicImbalance} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'Asymmetry (%)' }}
                tickFormatter={(value) => `${Math.abs(value)}% ${value < 0 ? 'Left' : 'Right'}`}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={10} stroke="#dc2626" strokeWidth={2} label={{ value: '10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#dc2626" strokeWidth={2} label={{ value: '-10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar 
                dataKey="Nordic Max Imbalance Value" 
                name="Asymmetry"
                fill="#ff6b00"
                style={({ payload }) => ({
                  fill: getBarFill(payload?.['Nordic Max Imbalance Value'])
                })}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Isometric Prone Force (N)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.isoProne} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis {...commonYAxisProps} label={{ ...commonYAxisProps.label, value: 'Force (N)' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={280} stroke="#22c55e" strokeWidth={2} label={{ value: 'High Performance (280N+)', position: 'right', fill: '#22c55e', fontSize: 12 }} />
              <ReferenceLine y={180} stroke="#dc2626" strokeWidth={2} label={{ value: 'Minimum Target (180N)', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar dataKey="ISO Prone Max Force L" fill="#ff6b00" name="Left" />
              <Bar dataKey="ISO Prone Max Force R" fill="#666" name="Right" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Isometric Prone Asymmetry (%)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.isoProneImbalance} {...commonChartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis {...commonXAxisProps} />
              <YAxis 
                {...commonYAxisProps} 
                label={{ ...commonYAxisProps.label, value: 'Asymmetry (%)' }}
                tickFormatter={(value) => `${Math.abs(value)}% ${value < 0 ? 'Left' : 'Right'}`}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={10} stroke="#dc2626" strokeWidth={2} label={{ value: '10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#dc2626" strokeWidth={2} label={{ value: '-10% Target Threshold', position: 'right', fill: '#dc2626', fontSize: 12 }} />
              <Bar 
                dataKey="ISO Prone Max Imbalance Value" 
                name="Asymmetry"
                fill="#ff6b00"
                style={({ payload }) => ({
                  fill: getBarFill(payload?.['ISO Prone Max Imbalance Value'])
                })}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Dashboard Component
const MainDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-6 bg-white border-b">
        <h1 className="text-3xl font-bold text-gray-900">Down GAA Senior Camogie</h1>
        <p className="text-gray-600">Sports Science Performance Dashboard</p>
      </header>

      <main className="p-4">
        <Tabs defaultValue="cmj" className="space-y-4">
          <TabsList className="bg-white p-1 gap-1">
            <TabsTrigger value="cmj" className="px-4 py-2">CMJ</TabsTrigger>
            <TabsTrigger value="cmrj" className="px-4 py-2">CMRJ</TabsTrigger>
            <TabsTrigger value="hop" className="px-4 py-2">Hop Test</TabsTrigger>
            <TabsTrigger value="hip" className="px-4 py-2">Hip Strength</TabsTrigger>
            <TabsTrigger value="hamstring" className="px-4 py-2">Hamstring</TabsTrigger>
          </TabsList>

          <TabsContent value="cmj">
            <CMJDashboard />
          </TabsContent>

          <TabsContent value="cmrj">
            <CMRJDashboard />
          </TabsContent>

          <TabsContent value="hop">
            <HopTestDashboard />
          </TabsContent>

          <TabsContent value="hip">
            <HipStrengthDashboard />
          </TabsContent>

          <TabsContent value="hamstring">
            <HamstringDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MainDashboard;