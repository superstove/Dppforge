import { useState } from 'react';
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react';
import { Input, Textarea } from '../components/Input';
import { api } from '../api';
import type { ChangeEvent, FormEvent } from 'react';
import type { ConversionResult, TechnicalProperty, ViewName } from '../types';

type TechPropRow = { name: string; value: string; unit: string; test_method: string };

export function ManualEntryView({
  setView,
  onReview,
}: {
  setView: (v: ViewName) => void;
  onReview: (data: ConversionResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    product_name: '',
    manufacturer: '',
    category: '',
    description: '',
    batch_number: '',
    origin_country: 'India',
    factory_location: '',
    packaging: '',
    storage: '',
    shelf_life_months: 12,
    standards_compliance: '',
    applications: '',
    recycled_content_pct: '',
    carbon_footprint_value: '',
    carbon_footprint_unit: 'kgCO2e/unit',
  });

  const [techProps, setTechProps] = useState([{ name: '', value: '', unit: '', test_method: '' }]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTechPropChange = (index: number, field: keyof TechPropRow, value: string) => {
    const newProps = [...techProps];
    newProps[index][field] = value;
    setTechProps(newProps);
  };

  const addTechProp = () => setTechProps([...techProps, { name: '', value: '', unit: '', test_method: '' }]);
  const removeTechProp = (index: number) => setTechProps(techProps.filter((_, i) => i !== index));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const technical_properties: Record<string, TechnicalProperty> = {};
    techProps.forEach(p => {
      if (p.name) {
        technical_properties[p.name] = {
          value: parseFloat(p.value) || p.value,
          unit: p.unit,
          test_method: p.test_method || undefined
        };
      }
    });

    const payload = {
      ...formData,
      shelf_life_months: parseInt(String(formData.shelf_life_months)) || 12,
      recycled_content_pct: parseFloat(String(formData.recycled_content_pct)) || 0,
      carbon_footprint_value: parseFloat(String(formData.carbon_footprint_value)) || 0,
      standards_compliance: formData.standards_compliance.split(',').map(s => s.trim()).filter(Boolean),
      applications: formData.applications.split(',').map(s => s.trim()).filter(Boolean),
      technical_properties,
      working_properties: {}
    };

    try {
      const res = await api.convertManual(payload);
      onReview(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit. Check backend connection and required fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 pb-36">
      <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-8 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </button>
      
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8 sm:mb-10 tracking-tight">Manual Data Entry</h2>
      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-2xl p-5 mb-8 text-[#fecaca] font-medium">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-6 flex items-center">
            <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center text-sm mr-3">1</span> 
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <Input label="Product Name" name="product_name" required value={formData.product_name} onChange={handleChange} placeholder="e.g. LATICRETE 335 Super Flex" />
            <Input label="Manufacturer" name="manufacturer" required value={formData.manufacturer} onChange={handleChange} placeholder="e.g. Sika India" />
            <Input label="Category" name="category" value={formData.category} onChange={handleChange} placeholder="e.g. Tile Adhesive" />
            <Input label="Batch Number" name="batch_number" value={formData.batch_number} onChange={handleChange} placeholder="e.g. SIKA-GROUT-212" />
            <Input label="Origin Country" name="origin_country" value={formData.origin_country} onChange={handleChange} />
            <Input label="Factory Location" name="factory_location" value={formData.factory_location} onChange={handleChange} />
          </div>
          <div className="mt-2">
            <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="Brief product description" />
          </div>
        </div>

        <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center text-sm mr-3">2</span> 
            Packaging & Storage
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Packaging" name="packaging" value={formData.packaging} onChange={handleChange} placeholder="e.g. 25 kg bags" />
            <Input label="Storage" name="storage" value={formData.storage} onChange={handleChange} placeholder="e.g. Dry, covered area" />
            <Input label="Shelf Life (months)" type="number" name="shelf_life_months" value={formData.shelf_life_months} onChange={handleChange} />
          </div>
        </div>

        <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
             <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center text-sm mr-3">3</span> 
             Standards & Applications
          </h3>
          <div className="grid grid-cols-1 gap-6">
            <Input label="Standards (comma-separated)" name="standards_compliance" value={formData.standards_compliance} onChange={handleChange} placeholder="ISO 10319, EN 13249" />
            <Input label="Applications (comma-separated)" name="applications" value={formData.applications} onChange={handleChange} placeholder="Road construction" />
          </div>
        </div>

        <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-white flex items-center">
               <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center text-sm mr-3">4</span> 
               Technical Properties
            </h3>
            <button type="button" onClick={addTechProp} className="flex items-center justify-center text-sm bg-white text-black font-medium px-4 py-2 rounded-full transition-colors hover:bg-gray-200">
              <Plus className="w-4 h-4 mr-1" /> Add Row
            </button>
          </div>
          <div className="space-y-4">
            {techProps.map((prop, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start p-4 bg-[#242736]/50 border border-[#2e3245] rounded-xl relative group">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Input placeholder="Property (e.g. density)" value={prop.name} onChange={(e) => handleTechPropChange(index, 'name', e.target.value)} />
                  <Input placeholder="Value (e.g. 1.8)" value={prop.value} onChange={(e) => handleTechPropChange(index, 'value', e.target.value)} />
                  <Input placeholder="Unit (e.g. g/cm³)" value={prop.unit} onChange={(e) => handleTechPropChange(index, 'unit', e.target.value)} />
                  <Input placeholder="Test Method" value={prop.test_method} onChange={(e) => handleTechPropChange(index, 'test_method', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeTechProp(index)} className="p-2.5 sm:mt-2 text-[#8b8fa3] hover:text-white hover:bg-[#ef4444] rounded-lg transition-colors border border-[#2e3245] sm:border-transparent hover:border-[#ef4444] flex justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            {techProps.length === 0 && <p className="text-sm text-[#8b8fa3] italic">No technical properties added.</p>}
          </div>
        </div>

        <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
             <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center text-sm mr-3">5</span> 
             Sustainability (Optional)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Recycled Content %" type="number" min="0" max="100" name="recycled_content_pct" value={formData.recycled_content_pct} onChange={handleChange} />
            <Input label="Carbon Footprint Value" type="number" step="0.01" name="carbon_footprint_value" value={formData.carbon_footprint_value} onChange={handleChange} />
            <Input label="Carbon Footprint Unit" name="carbon_footprint_unit" value={formData.carbon_footprint_unit} onChange={handleChange} />
          </div>
        </div>

        <div className="flex justify-end pt-6 sticky bottom-3 sm:bottom-6 z-20">
          <div className="w-full sm:w-auto bg-[#0f1117]/90 backdrop-blur-md border border-[#2e3245] p-3 sm:p-4 rounded-2xl sm:rounded-full flex items-center shadow-2xl">
            <span className="text-sm text-[#8b8fa3] mr-6 ml-2 hidden sm:inline-block">Ensure all required fields are filled</span>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto justify-center flex items-center bg-white text-black px-6 sm:px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              {loading ? 'Processing...' : 'Convert to DPP JSON'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
