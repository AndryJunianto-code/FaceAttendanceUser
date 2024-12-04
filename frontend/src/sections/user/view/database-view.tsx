import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Paper, Stack, TableCell, TableHead, TableRow,TableSortLabel, TextField } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { _users } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween' // import plugin
import { TableNoData } from '../table-no-data';
import { UserTableRow } from '../user-table-row';
import { UserTableHead } from '../user-table-head';
import { TableEmptyRows } from '../table-empty-rows';
import { UserTableToolbar } from '../user-table-toolbar';
import { emptyRows, applyFilter, getComparator } from '../utils';

import type { UserProps } from '../user-table-row';


// ----------------------------------------------------------------------
// Define types for the data you're working with
interface ReportData {
  user_id: string;
  name:string;
  date: string;
  time: string;
  status: string;
  validated_time: string;
}

export function DatabaseView() {
  dayjs.extend(isBetween);
  const table = useTable();

  const [filterName, setFilterName] = useState('');

  const dataFiltered: UserProps[] = applyFilter({
    inputData: _users,
    comparator: getComparator(table.order, table.orderBy),
    filterName,
  });

  const notFound = !dataFiltered.length && !!filterName;

  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<keyof ReportData>('date');
  const [search, setSearch] = useState<string>('');
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().endOf('month').format('YYYY-MM-DD'),
  ]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const response = await axios.get<ReportData[]>('http://localhost:5000/report');
      setReportData(response.data);
      setFilteredData(response.data);
    } catch (error) {
      console.error('Error fetching report data', error);
    }
  };

  const applyDateFilter = useCallback(() => {
    if (dateRange[0] && dateRange[1]) {
      const [startDate, endDate] = dateRange;
      const filtered = reportData.filter((item) =>
        dayjs(item.date).isBetween(startDate, endDate, 'day', '[]')
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(reportData);
    }
  }, [reportData, dateRange]);

  useEffect(() => {
    applyDateFilter();
  }, [reportData, dateRange,applyDateFilter]);

  const handleSort = (property: keyof ReportData) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);

    const sortedData = [...filteredData].sort((a, b) => {
      const valA = a[property];
      const valB = b[property];
      return (valA < valB ? -1 : 1) * (isAsc ? 1 : -1);
    });

    setFilteredData(sortedData);
  };

  const handleDateChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRange = [...dateRange] as [string, string];
    newRange[index] = event.target.value;
    setDateRange(newRange as [string, string]);
  };


  return (
    <DashboardContent>
      <Box display="flex" alignItems="center" mb={5}>
        <Typography variant="h4" flexGrow={1}>
          Staff Attendance Report
        </Typography>
       {/*  <Button
          variant="contained"
          color="inherit"
          startIcon={<Iconify icon="mingcute:add-line" />}
        >
          New user
        </Button> */}
      </Box>

      <Card>
      <Box paddingX='2rem' paddingTop='2rem'>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={dateRange[0]}
              onChange={handleDateChange(0)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={dateRange[1]}
              onChange={handleDateChange(1)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Box>

        <Scrollbar>
        <TableContainer component={Paper} sx={{padding:'2rem'}}>
     {/*  <TextField
        label="Search"
        variant="outlined"
        fullWidth
        margin="normal"
        onChange={(e) => setSearch(e.target.value)}
      /> */}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={orderBy === 'user_id'}
                direction={orderBy === 'user_id' ? order : 'asc'}
                onClick={() => handleSort('user_id')}
              >
                ID
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={orderBy === 'name'}
                direction={orderBy === 'name' ? order : 'asc'}
                onClick={() => handleSort('name')}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={orderBy === 'date'}
                direction={orderBy === 'date' ? order : 'asc'}
                onClick={() => handleSort('date')}
              >
                Date
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={orderBy === 'time'}
                direction={orderBy === 'time' ? order : 'asc'}
                onClick={() => handleSort('time')}
              >
                Time
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={orderBy === 'status'}
                direction={orderBy === 'status' ? order : 'asc'}
                onClick={() => handleSort('status')}
              >
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell>
            <TableSortLabel
                active={orderBy === 'validated_time'}
                direction={orderBy === 'validated_time' ? order : 'asc'}
                onClick={() => handleSort('validated_time')}
              >
                Validated Time
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{row.user_id}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.time}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.validated_time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
        </Scrollbar>
{/* 
        <TablePagination
          component="div"
          page={table.page}
          count={_users.length}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.onChangePage}
          rowsPerPageOptions={[5, 10, 25]}
          onRowsPerPageChange={table.onChangeRowsPerPage}
        /> */}
      </Card>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

export function useTable() {
  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState('name');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const onSort = useCallback(
    (id: string) => {
      const isAsc = orderBy === id && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(id);
    },
    [order, orderBy]
  );

  const onSelectAllRows = useCallback((checked: boolean, newSelecteds: string[]) => {
    if (checked) {
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  }, []);

  const onSelectRow = useCallback(
    (inputValue: string) => {
      const newSelected = selected.includes(inputValue)
        ? selected.filter((value) => value !== inputValue)
        : [...selected, inputValue];

      setSelected(newSelected);
    },
    [selected]
  );

  const onResetPage = useCallback(() => {
    setPage(0);
  }, []);

  const onChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const onChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      onResetPage();
    },
    [onResetPage]
  );

  return {
    page,
    order,
    onSort,
    orderBy,
    selected,
    rowsPerPage,
    onSelectRow,
    onResetPage,
    onChangePage,
    onSelectAllRows,
    onChangeRowsPerPage,
  };
}
