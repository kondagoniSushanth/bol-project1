import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

interface PressureData {
  timestamp: string;
  values: number[];
}

class ExportManager {
  async exportToExcel(
    pressureData: PressureData[], 
    averagePressures: number[], 
    doctorNotes: string,
    soleType: 'left' | 'right'
  ): Promise<void> {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Raw data sheet
      const rawDataRows = [
        ['Timestamp', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        ...pressureData.map(data => [data.timestamp, ...data.values])
      ];
      
      const rawDataSheet = XLSX.utils.aoa_to_sheet(rawDataRows);
      XLSX.utils.book_append_sheet(workbook, rawDataSheet, 'Raw Data');
      
      // Summary sheet
      const summaryRows = [
        ['Foot Pressure Analysis Summary'],
        [''],
        ['Sole Type:', soleType.toUpperCase()],
        ['Test Date:', new Date().toLocaleDateString()],
        ['Test Time:', new Date().toLocaleTimeString()],
        ['Duration:', '20 seconds'],
        [''],
        ['Pressure Point Averages (kPa):'],
        ['Point', 'Average Pressure'],
        ...averagePressures.map((pressure, index) => [`P${index + 1}`, pressure]),
        [''],
        ['Overall Statistics:'],
        ['Total Average:', Math.round(averagePressures.reduce((sum, val) => sum + val, 0) / averagePressures.length)],
        ['Maximum Pressure:', Math.max(...averagePressures)],
        ['Minimum Pressure:', Math.min(...averagePressures)],
        [''],
        ['Doctor Notes:'],
        [doctorNotes || 'No notes provided']
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Export file
      const fileName = `foot_pressure_${soleType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  async exportHeatmapImage(containerId: string, fileName: string): Promise<void> {
    try {
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error('Heatmap container not found');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#1e1e1e',
        scale: 2,
        logging: false
      });

      // Create download link
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting heatmap image:', error);
      throw error;
    }
  }

  async exportAll(
    pressureData: PressureData[],
    averagePressures: number[],
    doctorNotes: string,
    soleType: 'left' | 'right',
    heatmapContainerId: string
  ): Promise<void> {
    try {
      const zip = new JSZip();
      
      // Add Excel file
      const workbook = XLSX.utils.book_new();
      
      const rawDataRows = [
        ['Timestamp', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
        ...pressureData.map(data => [data.timestamp, ...data.values])
      ];
      
      const rawDataSheet = XLSX.utils.aoa_to_sheet(rawDataRows);
      XLSX.utils.book_append_sheet(workbook, rawDataSheet, 'Raw Data');
      
      const summaryRows = [
        ['Foot Pressure Analysis Summary'],
        [''],
        ['Sole Type:', soleType.toUpperCase()],
        ['Test Date:', new Date().toLocaleDateString()],
        ['Test Time:', new Date().toLocaleTimeString()],
        ['Duration:', '20 seconds'],
        [''],
        ['Pressure Point Averages (kPa):'],
        ['Point', 'Average Pressure'],
        ...averagePressures.map((pressure, index) => [`P${index + 1}`, pressure]),
        [''],
        ['Overall Statistics:'],
        ['Total Average:', Math.round(averagePressures.reduce((sum, val) => sum + val, 0) / averagePressures.length)],
        ['Maximum Pressure:', Math.max(...averagePressures)],
        ['Minimum Pressure:', Math.min(...averagePressures)],
        [''],
        ['Doctor Notes:'],
        [doctorNotes || 'No notes provided']
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      zip.file(`foot_pressure_${soleType}_data.xlsx`, excelBuffer);
      
      // Add heatmap image
      const element = document.getElementById(heatmapContainerId);
      if (element) {
        const canvas = await html2canvas(element, {
          backgroundColor: '#1e1e1e',
          scale: 2,
          logging: false
        });
        
        const imageData = canvas.toDataURL('image/png').split(',')[1];
        zip.file(`${soleType}_sole_heatmap.png`, imageData, { base64: true });
      }
      
      // Add doctor notes
      zip.file('doctor_notes.txt', doctorNotes || 'No notes provided');
      
      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `foot_pressure_${soleType}_complete_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error creating export package:', error);
      throw error;
    }
  }
}

export default ExportManager;