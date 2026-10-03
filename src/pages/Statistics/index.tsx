import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert as MuiAlert,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  FileDownload,
  TrendingUp,
  TrendingDown,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import EChartsReact from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { echarts } from '../../utils/echarts';

const Statistics: React.FC = () => {
  const [efficiency, setEfficiency] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [comparison, setComparison] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const chartRef1 = useRef<EChartsReact>(null);
  const chartRef2 = useRef<EChartsReact>(null);
  const chartRef3 = useRef<EChartsReact>(null);
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      const [effRes, compRes] = await Promise.all([
        api.get('/stats/efficiency', { params: { days } }),
        api.get('/reports/comparison', { params: { days } }),
      ]);
      setEfficiency(effRes.data);
      setComparison(compRes.data);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const handleExportExcel = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    window.open(`${api.defaults.baseURL}/reports/export/excel?start_date=${startStr}&end_date=${endStr}`, '_blank');
    setToastMessage(t('pages.statistics.downloadingExcel') || '正在导出 Excel 生产报表');
  };

  const handleExportCSV = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    window.open(`${api.defaults.baseURL}/reports/export/csv?start_date=${startStr}&end_date=${endStr}`, '_blank');
    setToastMessage(t('pages.statistics.downloadingCsv') || '正在导出 CSV 质量数据');
  };

  const toolbox = {
    show: true,
    feature: { saveAsImage: { title: t('pages.statistics.saveImage') || '保存图片', pixelRatio: 2 } },
  };

  const productionOption = {
    title: { text: t('pages.statistics.productionTrend') || '产线日产量趋势分析', left: 16, textStyle: { fontSize: 15, fontWeight: 600 } },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    grid: { left: 40, right: 30, bottom: 30, top: 50 },
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const },
    series: [
      { name: t('pages.statistics.production') || '产量', type: 'bar', data: efficiency.map((e) => e.total_count), itemStyle: { color: '#1a73e8', borderRadius: [4, 4, 0, 0] } },
    ],
  };

  const yieldOption = {
    title: { text: t('pages.statistics.yieldTrend') || '产线良率与品质达标率', left: 16, textStyle: { fontSize: 15, fontWeight: 600 } },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    grid: { left: 40, right: 30, bottom: 30, top: 50 },
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const, min: 80, max: 100 },
    series: [
      { name: t('pages.statistics.yieldRate') || '良品率', type: 'line', data: efficiency.map((e) => e.yield_rate), itemStyle: { color: '#34a853' }, areaStyle: { color: 'rgba(52, 168, 83, 0.15)' } },
    ],
  };

  const cycleTimeOption = {
    title: { text: t('pages.statistics.cycleTimeTrend') || '平均工时节拍 (CT 趋势)', left: 16, textStyle: { fontSize: 15, fontWeight: 600 } },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    grid: { left: 40, right: 30, bottom: 30, top: 50 },
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const, name: t('pages.statistics.seconds') || '秒' },
    series: [
      { name: t('pages.statistics.cycleTime') || '节拍', type: 'line', data: efficiency.map((e) => e.avg_cycle_time), smooth: true, itemStyle: { color: '#fbbc04' } },
    ],
  };

  const comp = comparison?.comparison;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Top Filter and Actions Toolbar */}
      <Card>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartIcon sx={{ color: '#1a73e8' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              质量与生产节拍统计报表
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="days-select-label">统计周期</InputLabel>
              <Select
                labelId="days-select-label"
                value={days}
                label="统计周期"
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <MenuItem value={7}>{t('pages.statistics.last7days') || '近 7 天数据'}</MenuItem>
                <MenuItem value={14}>{t('pages.statistics.last14days') || '近 14 天数据'}</MenuItem>
                <MenuItem value={30}>{t('pages.statistics.last30days') || '近 30 天数据'}</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownload />}
              onClick={handleExportExcel}
            >
              {t('pages.statistics.exportExcel') || '导出 Excel'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              onClick={handleExportCSV}
            >
              {t('pages.statistics.exportCsv') || '导出 CSV'}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Comparison Metrics */}
      {comp && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t('pages.statistics.productionChange') || '产量环比'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {comp.total_production?.change_percent >= 0 ? (
                    <TrendingUp sx={{ color: '#1e8e3e' }} />
                  ) : (
                    <TrendingDown sx={{ color: '#d93025' }} />
                  )}
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: comp.total_production?.change_percent >= 0 ? '#1e8e3e' : '#d93025',
                    }}
                  >
                    {comp.total_production?.change_percent?.toFixed(1) ?? 0}%
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  本期 {comp.total_production?.current} / 上期 {comp.total_production?.previous}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t('pages.statistics.yieldChange') || '良品率环比'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {comp.yield_rate?.change_percent >= 0 ? (
                    <TrendingUp sx={{ color: '#1e8e3e' }} />
                  ) : (
                    <TrendingDown sx={{ color: '#d93025' }} />
                  )}
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: comp.yield_rate?.change_percent >= 0 ? '#1e8e3e' : '#d93025',
                    }}
                  >
                    {comp.yield_rate?.change_percent?.toFixed(2) ?? 0}%
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  本期 {comp.yield_rate?.current}% / 上期 {comp.yield_rate?.previous}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t('pages.statistics.defectChange') || '缺陷量环比'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {comp.total_defects?.change_percent <= 0 ? (
                    <TrendingDown sx={{ color: '#1e8e3e' }} />
                  ) : (
                    <TrendingUp sx={{ color: '#d93025' }} />
                  )}
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: comp.total_defects?.change_percent <= 0 ? '#1e8e3e' : '#d93025',
                    }}
                  >
                    {comp.total_defects?.change_percent?.toFixed(1) ?? 0}%
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  本期 {comp.total_defects?.current} / 上期 {comp.total_defects?.previous}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  {t('pages.statistics.cycleTimeChange') || '平均节拍环比'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {comp.avg_cycle_time?.change_percent <= 0 ? (
                    <TrendingDown sx={{ color: '#1e8e3e' }} />
                  ) : (
                    <TrendingUp sx={{ color: '#d93025' }} />
                  )}
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: comp.avg_cycle_time?.change_percent <= 0 ? '#1e8e3e' : '#d93025',
                    }}
                  >
                    {comp.avg_cycle_time?.change_percent?.toFixed(1) ?? 0}%
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                  本期 {comp.avg_cycle_time?.current}s / 上期 {comp.avg_cycle_time?.previous}s
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Chart Containers */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 2 }}>
            <EChartsReact echarts={echarts} ref={chartRef1} option={productionOption} style={{ height: 320 }} />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2 }}>
            <EChartsReact echarts={echarts} ref={chartRef2} option={yieldOption} style={{ height: 300 }} />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2 }}>
            <EChartsReact echarts={echarts} ref={chartRef3} option={cycleTimeOption} style={{ height: 300 }} />
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert onClose={() => setToastMessage(null)} severity="info" sx={{ width: '100%' }}>
          {toastMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default Statistics;
