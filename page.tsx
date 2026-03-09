/**
 * ROV Detail & Response Page
 * Detailed view and response workflow for Reconsideration of Value requests
 */

'use client';

import { useState, useEffect } from 'react';
import { formatPropertyAddress } from '../../../../utils/format';
import { useParams, useNavigate } from 'react-router-dom';
import {
	Box,
	Card,
	CardContent,
	Grid,
	Typography,
	Button,
	Chip,
	Divider,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	MenuItem,
	Alert,
	List,
	ListItem,
	ListItemText,
	Paper,
	Tabs,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TableContainer,
	LinearProgress,
	Checkbox,
	Tooltip,
	CircularProgress,
	Snackbar,
} from '@mui/material';
import {
	Timeline,
	TimelineItem,
	TimelineSeparator,
	TimelineConnector,
	TimelineContent,
	TimelineDot,
} from '@mui/lab';
import {
	ArrowBack as BackIcon,
	CheckCircle as ApproveIcon,
	Cancel as RejectIcon,
	Edit as EditIcon,
	AttachFile as AttachIcon,
	Send as SendIcon,
	Download as DownloadIcon,
	Gavel as ROVIcon,
	Home as PropertyIcon,
	TrendingUp,
	TrendingDown,
	Person as PersonIcon,
	Business as ClientIcon,
	Save as SaveIcon,
	Add as AddIcon,
	Delete as DeleteIcon,
	Analytics as AnalyticsIcon,
	TrendingFlat,
	Forum as ForumIcon,
	Email as EmailIcon,
	Sms as SmsIcon,
} from '@mui/icons-material';
import { useCommunicationContext } from '@/contexts/CommunicationContext';
import CommunicationHistory from '@/components/communication/CommunicationHistory';
import SendMessageDialog from '@/components/communication/SendMessageDialog';
import { useGetROVRequestQuery, useSubmitROVResponseMutation, useUpdateROVResearchMutation } from '@/store/api';
import type { ROVDecision, ROVComparable, ROVResearch } from '@/store/api/rovApi';
import useUser from '@auth/useUser';
import { useSetPageContext } from '@/hooks/useSetPageContext';
import { downloadDocumentAuthenticated } from '@/hooks/useAuthenticatedDocument';
import { CollaborationProvider } from '@/contexts/CollaborationContext';
import { CollaboratorAvatars } from '@/components/collaboration/CollaboratorAvatars';
import { CollaborativeTextField } from '@/components/collaboration/CollaborativeTextField';
import { rovContainerSchema } from '@/services/collaboration/schemas';

export default function ROVDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { data: user } = useUser();
	const [tabValue, setTabValue] = useState(0);
	const [responseDialogOpen, setResponseDialogOpen] = useState(false);
	const [msgOpen, setMsgOpen] = useState(false);
	const [msgChannel, setMsgChannel] = useState<'email' | 'sms' | 'teams'>('email');

	const { setEntity, clearEntity } = useCommunicationContext();
	const [responseType, setResponseType] = useState<'approve' | 'reject'>('approve');
	const [approvedValue, setApprovedValue] = useState('');
	const [responseNotes, setResponseNotes] = useState('');
	const { setCustomFields } = useSetPageContext();

	// Fetch ROV data from backend
	const { data: rovDetail, isLoading } = useGetROVRequestQuery(id || '', { skip: !id });
	const [submitROVResponse, { isLoading: submitting }] = useSubmitROVResponseMutation();
	const [updateROVResearch, { isLoading: savingResearch }] = useUpdateROVResearchMutation();

	// Local research editing state
	const [localResearch, setLocalResearch] = useState<Partial<ROVResearch> | null>(null);
	const [researchDirty, setResearchDirty] = useState(false);
	const [snackMessage, setSnackMessage] = useState('');
	const [addCompDialogOpen, setAddCompDialogOpen] = useState(false);
	const [newComp, setNewComp] = useState<Partial<ROVComparable>>({
		address: '', city: '', state: '', zipCode: '', condition: 'Average',
		salePrice: 0, squareFootage: 0, bedrooms: 0, bathrooms: 0, yearBuilt: 0,
		distanceFromSubject: 0, adjustments: { total: 0 }, adjustedValue: 0,
		source: '', selected: true,
	});

	// Sync local research from server data
	useEffect(() => {
		if (rovDetail?.research && !researchDirty) {
			setLocalResearch(rovDetail.research);
		}
	}, [rovDetail?.research, researchDirty]);

	// Register ROV as active communication entity
	useEffect(() => {
		if (!rovDetail || !id) return;
		setEntity({
			type: 'rov',
			id,
			name: rovDetail.rovNumber,
			email: rovDetail.requestorEmail,
			phone: rovDetail.requestorPhone,
		});
		return () => { clearEntity(); };
	}, [rovDetail, id, setEntity, clearEntity]);

	// Push ROV context to AI assistant (hooks must be before early returns)
	useEffect(() => {
		if (!rovDetail) return;
		setCustomFields({
			rovId: rovDetail.id,
			orderId: rovDetail.orderId,
			rovNumber: rovDetail.rovNumber,
			propertyAddress: rovDetail.propertyAddress,
			rovStatus: rovDetail.status,
			rovPriority: rovDetail.priority ?? null,
			originalValue: rovDetail.originalAppraisalValue ?? null,
			requestedValue: rovDetail.requestedValue ?? null,
		});
	}, [rovDetail, setCustomFields]);

	// Show loading state
	if (isLoading) {
		return <LinearProgress />;
	}

	// Return early if no data
	if (!rovDetail) {
		return <Typography>ROV request not found</Typography>;
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'SUBMITTED': return 'warning';
			case 'UNDER_REVIEW': return 'info';
			case 'RESEARCHING': return 'info';
			case 'ACCEPTED': return 'success';
			case 'REJECTED': return 'error';
			case 'RESPONDED': return 'success';
			case 'WITHDRAWN': return 'default';
			case 'ESCALATED': return 'error';
			default: return 'default';
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case 'HIGH': return 'error';
			case 'MEDIUM': return 'warning';
			case 'LOW': return 'success';
			default: return 'default';
		}
	};

	const handleResponse = (type: 'approve' | 'reject') => {
		setResponseType(type);
		if (type === 'approve' && rovDetail.requestedValue != null) {
			setApprovedValue(rovDetail.requestedValue.toString());
		}
		setResponseDialogOpen(true);
	};

	const handleSubmitResponse = async () => {
		if (!id) return;

		try {
			const decision: ROVDecision = responseType === 'approve' ? 'VALUE_INCREASED' : 'VALUE_UNCHANGED';
			await submitROVResponse({
				id,
				data: {
					decision,
					...(responseType === 'approve' ? { newValue: parseFloat(approvedValue) } : {}),
					explanation: responseNotes,
				}
			}).unwrap();

			setResponseDialogOpen(false);
			navigate('/rov'); // Return to list
		} catch (error) {
			console.error('Failed to submit ROV response:', error);
		}
	};

	const handleDownloadDocument = async (docId: string, fileName?: string): Promise<void> => {
		try {
			await downloadDocumentAuthenticated(docId, fileName);
		} catch (error) {
			console.error('[ROVDetailPage] Document download failed:', error);
		}
	};

	/* ── Research workspace handlers ── */

	const handleResearchFieldChange = (field: keyof ROVResearch, value: unknown) => {
		setLocalResearch((prev) => ({ ...prev, [field]: value }));
		setResearchDirty(true);
	};

	const handleToggleCompSelected = (compId: string) => {
		const comps = [...(localResearch?.comparables ?? [])];
		const idx = comps.findIndex((c) => c.id === compId);
		if (idx >= 0) {
			comps[idx] = { ...comps[idx], selected: !comps[idx].selected };
			handleResearchFieldChange('comparables', comps);
		}
	};

	const handleRemoveComp = (compId: string) => {
		const comps = (localResearch?.comparables ?? []).filter((c) => c.id !== compId);
		handleResearchFieldChange('comparables', comps);
	};

	const handleAddComp = () => {
		const comp: ROVComparable = {
			id: `comp-${Date.now()}`,
			address: newComp.address ?? '',
			city: newComp.city ?? '',
			state: newComp.state ?? '',
			zipCode: newComp.zipCode ?? '',
			salePrice: newComp.salePrice ?? 0,
			saleDate: new Date().toISOString(),
			distanceFromSubject: newComp.distanceFromSubject ?? 0,
			squareFootage: newComp.squareFootage ?? 0,
			bedrooms: newComp.bedrooms ?? 0,
			bathrooms: newComp.bathrooms ?? 0,
			yearBuilt: newComp.yearBuilt ?? 0,
			condition: newComp.condition ?? 'Average',
			adjustments: { total: newComp.adjustments?.total ?? 0 },
			adjustedValue: newComp.adjustedValue ?? 0,
			source: newComp.source ?? '',
			selected: true,
		};
		handleResearchFieldChange('comparables', [...(localResearch?.comparables ?? []), comp]);
		setAddCompDialogOpen(false);
		setNewComp({
			address: '', city: '', state: '', zipCode: '', condition: 'Average',
			salePrice: 0, squareFootage: 0, bedrooms: 0, bathrooms: 0, yearBuilt: 0,
			distanceFromSubject: 0, adjustments: { total: 0 }, adjustedValue: 0,
			source: '', selected: true,
		});
	};

	const handleSaveResearch = async () => {
		if (!id || !localResearch) return;
		try {
			await updateROVResearch({
				id,
				data: {
					research: localResearch,
					...(localResearch.internalNotes != null ? { internalNotes: localResearch.internalNotes } : {}),
				},
			}).unwrap();
			setResearchDirty(false);
			setSnackMessage('Research saved successfully');
		} catch (error) {
			console.error('[ROVDetailPage] Failed to save research:', error);
			setSnackMessage('Failed to save research');
		}
	};

	const isResearchEditable = rovDetail.status === 'UNDER_REVIEW' || rovDetail.status === 'RESEARCHING';

	const marketTrendIcon = (trend?: string) => {
		if (trend === 'INCREASING') return <TrendingUp fontSize="small" color="success" />;
		if (trend === 'DECLINING') return <TrendingDown fontSize="small" color="error" />;
		return <TrendingFlat fontSize="small" color="action" />;
	};

	return (
		<CollaborationProvider
			containerId={`rov-${id}`}
			schema={rovContainerSchema}
			mapKey="rovFields"
		>
		<Box sx={{ p: 4 }}>
			{/* Header */}
			<Box sx={{ mb: 4 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
					<IconButton onClick={() => navigate('/rov')} size="large">
						<BackIcon />
					</IconButton>
					<Box sx={{ flex: 1 }}>
						<Typography variant="h3" fontWeight={800}>
							ROV Request {rovDetail.rovNumber}
						</Typography>
						<Typography variant="body1" color="textSecondary">
						Order {rovDetail.orderId} • {formatPropertyAddress(rovDetail.propertyAddress)}
						</Typography>
					</Box>
					<Chip 
						label={rovDetail.status.replace('_', ' ')} 
						color={getStatusColor(rovDetail.status) as any}
						size="medium"
						sx={{ fontWeight: 600, px: 2 }}
					/>
				{rovDetail.priority && (
					<Chip 
						label={`${rovDetail.priority} Priority`} 
						color={getPriorityColor(rovDetail.priority) as any}
						size="medium"
					/>
				)}
				<CollaboratorAvatars />
				</Box>

				{/* Action Buttons */}
				{(rovDetail.status === 'UNDER_REVIEW' || rovDetail.status === 'RESEARCHING') && (
					<Box sx={{ display: 'flex', gap: 2 }}>
						<Button
							variant="contained"
							color="success"
							startIcon={<ApproveIcon />}
							onClick={() => handleResponse('approve')}
							size="large"
						>
							Approve Request
						</Button>
						<Button
							variant="contained"
							color="error"
							startIcon={<RejectIcon />}
							onClick={() => handleResponse('reject')}
							size="large"
						>
							Reject Request
						</Button>
						<Button
							variant="outlined"
							startIcon={<EditIcon />}
							size="large"
						>
							Request Additional Info
						</Button>
					</Box>
				)}
			</Box>

			{/* Shared internal notes — visible to all reviewers simultaneously */}
			<CollaborativeTextField
				fieldKey="internalNotes"
				label="Internal Review Notes"
				multiline
				rows={3}
				placeholder="Draft shared notes for this ROV — visible to all active reviewers..."
				sx={{ mb: 3 }}
			/>

			<Grid container spacing={3}>
				{/* Value Comparison */}
				<Grid item xs={12}>
					<Card>
						<CardContent>
							<Typography variant="h6" fontWeight={600} gutterBottom>
								Value Analysis
							</Typography>
							<Grid container spacing={3} sx={{ mt: 1 }}>
								<Grid item xs={12} md={3}>
									<Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
										<Typography variant="body2" color="textSecondary" gutterBottom>
											Original Appraised Value
										</Typography>
										<Typography variant="h4" fontWeight={700}>
											${(rovDetail.originalAppraisalValue ?? 0).toLocaleString()}
										</Typography>
									</Paper>
								</Grid>
								<Grid item xs={12} md={3}>
									<Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'primary.50' }}>
										<Typography variant="body2" color="textSecondary" gutterBottom>
											Requested Value
										</Typography>
										<Typography variant="h4" fontWeight={700} color="primary">
											${(rovDetail.requestedValue ?? 0).toLocaleString()}
										</Typography>
									</Paper>
								</Grid>
								<Grid item xs={12} md={3}>
									<Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.50' }}>
										<Typography variant="body2" color="textSecondary" gutterBottom>
											Difference
										</Typography>
										<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
											<TrendingUp color="success" />
											<Typography variant="h4" fontWeight={700} color="success.main">
											${((rovDetail.requestedValue ?? 0) - (rovDetail.originalAppraisalValue ?? 0)).toLocaleString()}
										</Typography>
									</Box>
								</Paper>
							</Grid>
							<Grid item xs={12} md={3}>
								<Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.50' }}>
									<Typography variant="body2" color="textSecondary" gutterBottom>
										Percent Change
									</Typography>
									<Typography variant="h4" fontWeight={700} color="warning.main">
										+{rovDetail.originalAppraisalValue ? (((rovDetail.requestedValue ?? 0) - rovDetail.originalAppraisalValue) / rovDetail.originalAppraisalValue * 100).toFixed(1) : 0}%
										</Typography>
									</Paper>
								</Grid>
							</Grid>
						</CardContent>
					</Card>
				</Grid>

				{/* Main Content Tabs */}
				<Grid item xs={12}>
					<Card>
						<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
							<Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
								<Tab label="Request Details" />
								<Tab label="Supporting Documents" />
								<Tab label="Research Workspace" />
								<Tab label="Timeline" />
								<Tab icon={<ForumIcon />} iconPosition="start" label="Communications" />
							</Tabs>
						</Box>

						<Grid container spacing={3}>
									<Grid item xs={12} md={6}>
										<Typography variant="subtitle2" color="textSecondary" gutterBottom>
											Requestor Information
										</Typography>
										<TableContainer>
											<Table size="small">
												<TableBody>
													<TableRow>
														<TableCell sx={{ fontWeight: 600, width: '40%' }}>Name</TableCell>
													<TableCell>{rovDetail.requestorName}</TableCell>
												</TableRow>
												{rovDetail.requestorType && (
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
														<TableCell>{rovDetail.requestorType.replace('_', ' ')}</TableCell>
													</TableRow>
												)}
												{rovDetail.requestorEmail && (
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
														<TableCell>{rovDetail.requestorEmail}</TableCell>
													</TableRow>
												)}
												{rovDetail.requestorPhone && (
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
														<TableCell>{rovDetail.requestorPhone}</TableCell>
													</TableRow>
												)}
												</TableBody>
											</Table>
										</TableContainer>
									</Grid>

									<Grid item xs={12} md={6}>
										<Typography variant="subtitle2" color="textSecondary" gutterBottom>
											Request Details
										</Typography>
										<TableContainer>
											<Table size="small">
												<TableBody>
													<TableRow>
														<TableCell sx={{ fontWeight: 600, width: '40%' }}>Request Date</TableCell>
													<TableCell>{new Date(rovDetail.createdAt).toLocaleString()}</TableCell>
												</TableRow>
												<TableRow>
													<TableCell sx={{ fontWeight: 600 }}>Last Updated</TableCell>
													<TableCell>
														{new Date(rovDetail.updatedAt).toLocaleString()}
														</TableCell>
													</TableRow>
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Assigned Reviewer</TableCell>
														<TableCell>{rovDetail.assignedTo || 'Unassigned'}</TableCell>
													</TableRow>
												{rovDetail.priority && (
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
														<TableCell>
															<Chip 
																label={rovDetail.priority} 
																color={getPriorityColor(rovDetail.priority) as any}
																size="small"
															/>
														</TableCell>
													</TableRow>
												)}
													<TableRow>
														<TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
														<TableCell>
															<Chip 
																label={rovDetail.status.replace('_', ' ')} 
																color={getStatusColor(rovDetail.status) as any}
																size="small"
															/>
														</TableCell>
													</TableRow>
												</TableBody>
											</Table>
										</TableContainer>
									</Grid>

									<Grid item xs={12}>
										<Divider sx={{ my: 2 }} />
										<Typography variant="subtitle2" color="textSecondary" gutterBottom>
											Challenge Reason
										</Typography>
										<Chip label={rovDetail.challengeReason.replace(/_/g, ' ')} size="small" sx={{ mb: 1 }} />
										<Typography variant="body1" sx={{ mb: 2 }}>
											{rovDetail.challengeDescription}
										</Typography>

									</Grid>
								</Grid>
							</CardContent>
						)}

						{/* Tab 1: Supporting Documents */}
						{tabValue === 1 && (
							<CardContent>
								<List>
								{(rovDetail.supportingEvidence || []).map((doc) => (
										<ListItem
											key={doc.id}
											secondaryAction={
											<IconButton edge="end" onClick={() => handleDownloadDocument(doc.id, doc.fileName)}>
													<DownloadIcon />
												</IconButton>
											}
										>
											<AttachIcon sx={{ mr: 2, color: 'text.secondary' }} />
											<ListItemText
												primary={doc.fileName ?? doc.description}
												secondary={`${doc.type} • Uploaded ${new Date(doc.uploadedAt).toLocaleString()}`}
											/>
										</ListItem>
									))}
								</List>
							</CardContent>
						)}

						{/* Tab 2: Research Workspace */}
						{tabValue === 2 && (
							<CardContent>
								{/* Save bar */}
								{isResearchEditable && (
									<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
										{researchDirty && (
											<Chip label="Unsaved changes" color="warning" size="small" />
										)}
										{localResearch?.researchCompletedAt && (
											<Chip
												label={`Completed by ${localResearch.researchCompletedBy ?? 'unknown'} on ${new Date(localResearch.researchCompletedAt).toLocaleDateString()}`}
												color="success"
												size="small"
											/>
										)}
										<Button
											variant="contained"
											startIcon={savingResearch ? <CircularProgress size={18} /> : <SaveIcon />}
											onClick={handleSaveResearch}
											disabled={!researchDirty || savingResearch}
										>
											Save Research
										</Button>
									</Box>
								)}

								{/* Market Analysis Summary */}
								{localResearch?.marketAnalysis && (
									<Box sx={{ mb: 3 }}>
										<Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<AnalyticsIcon fontSize="small" /> Market Analysis
										</Typography>
										<Grid container spacing={2}>
											<Grid item xs={6} sm={3}>
												<Paper sx={{ p: 2, textAlign: 'center' }}>
													<Typography variant="caption" color="textSecondary">Average Value</Typography>
													<Typography variant="h6" fontWeight={700}>
														${localResearch.marketAnalysis.averageValue.toLocaleString()}
													</Typography>
												</Paper>
											</Grid>
											<Grid item xs={6} sm={3}>
												<Paper sx={{ p: 2, textAlign: 'center' }}>
													<Typography variant="caption" color="textSecondary">Median Value</Typography>
													<Typography variant="h6" fontWeight={700}>
														${localResearch.marketAnalysis.medianValue.toLocaleString()}
													</Typography>
												</Paper>
											</Grid>
											<Grid item xs={6} sm={3}>
												<Paper sx={{ p: 2, textAlign: 'center' }}>
													<Typography variant="caption" color="textSecondary">Value Range</Typography>
													<Typography variant="h6" fontWeight={700}>
														${localResearch.marketAnalysis.valueRange.min.toLocaleString()} – ${localResearch.marketAnalysis.valueRange.max.toLocaleString()}
													</Typography>
												</Paper>
											</Grid>
											<Grid item xs={6} sm={3}>
												<Paper sx={{ p: 2, textAlign: 'center' }}>
													<Typography variant="caption" color="textSecondary">Market Trend</Typography>
													<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
														{marketTrendIcon(localResearch.marketAnalysis.marketTrend)}
														<Typography variant="h6" fontWeight={700}>
															{localResearch.marketAnalysis.marketTrend}
														</Typography>
													</Box>
													{localResearch.marketAnalysis.trendPercentage != null && (
														<Typography variant="caption" color="textSecondary">
															{localResearch.marketAnalysis.trendPercentage > 0 ? '+' : ''}
															{localResearch.marketAnalysis.trendPercentage.toFixed(1)}%
														</Typography>
													)}
												</Paper>
											</Grid>
										</Grid>
										<Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
											Days since original appraisal: {localResearch.marketAnalysis.daysSinceAppraisal}
										</Typography>
									</Box>
								)}

								{/* Original Appraisal Info */}
								{localResearch?.originalAppraiser && (
									<Alert severity="info" sx={{ mb: 2 }}>
										Original appraisal by <strong>{localResearch.originalAppraiser}</strong>
										{localResearch.originalAppraisalDate && (
											<> on {new Date(localResearch.originalAppraisalDate).toLocaleDateString()}</>
										)}
										{localResearch.originalAppraisalId && (
											<> (ID: {localResearch.originalAppraisalId})</>
										)}
									</Alert>
								)}

								{/* Comparables Table */}
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
									<Typography variant="subtitle1" fontWeight={600}>
										Comparable Properties ({(localResearch?.comparables ?? []).length})
									</Typography>
									{isResearchEditable && (
										<Button
											variant="outlined"
											size="small"
											startIcon={<AddIcon />}
											onClick={() => setAddCompDialogOpen(true)}
										>
											Add Comparable
										</Button>
									)}
								</Box>

								{(localResearch?.comparables ?? []).length > 0 ? (
									<>
										<TableContainer component={Paper} variant="outlined">
											<Table size="small">
												<TableHead>
													<TableRow>
														{isResearchEditable && <TableCell padding="checkbox">Use</TableCell>}
														<TableCell>Address</TableCell>
														<TableCell align="right">Sale Price</TableCell>
														<TableCell align="right">Adj. Value</TableCell>
														<TableCell align="right">Sq Ft</TableCell>
														<TableCell align="center">Bed/Bath</TableCell>
														<TableCell align="right">Year</TableCell>
														<TableCell>Condition</TableCell>
														<TableCell align="right">Adj. Total</TableCell>
														<TableCell>Source</TableCell>
														{isResearchEditable && <TableCell padding="checkbox" />}
													</TableRow>
												</TableHead>
												<TableBody>
													{(localResearch?.comparables ?? []).map((comp) => (
														<TableRow
															key={comp.id}
															sx={{ opacity: comp.selected ? 1 : 0.5 }}
														>
															{isResearchEditable && (
																<TableCell padding="checkbox">
																	<Checkbox
																		checked={comp.selected}
																		onChange={() => handleToggleCompSelected(comp.id)}
																		size="small"
																	/>
																</TableCell>
															)}
															<TableCell>
																<Typography variant="body2" fontWeight={500}>{comp.address}</Typography>
																<Typography variant="caption" color="textSecondary">
																	{comp.city}, {comp.state} {comp.zipCode}
																</Typography>
															</TableCell>
															<TableCell align="right" sx={{ fontWeight: 600 }}>
																${comp.salePrice.toLocaleString()}
															</TableCell>
															<TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
																${comp.adjustedValue.toLocaleString()}
															</TableCell>
															<TableCell align="right">{comp.squareFootage.toLocaleString()}</TableCell>
															<TableCell align="center">{comp.bedrooms}/{comp.bathrooms}</TableCell>
															<TableCell align="right">{comp.yearBuilt}</TableCell>
															<TableCell>{comp.condition}</TableCell>
															<TableCell align="right">
																<Tooltip title={`Loc: ${comp.adjustments.location ?? 0} | Size: ${comp.adjustments.size ?? 0} | Cond: ${comp.adjustments.condition ?? 0} | Feat: ${comp.adjustments.features ?? 0}`}>
																	<Typography variant="body2">
																		${comp.adjustments.total.toLocaleString()}
																	</Typography>
																</Tooltip>
															</TableCell>
															<TableCell>
																<Typography variant="caption">{comp.source}</Typography>
															</TableCell>
															{isResearchEditable && (
																<TableCell padding="checkbox">
																	<IconButton size="small" color="error" onClick={() => handleRemoveComp(comp.id)}>
																		<DeleteIcon fontSize="small" />
																	</IconButton>
																</TableCell>
															)}
														</TableRow>
													))}
												</TableBody>
											</Table>
										</TableContainer>

										{/* Comp stats row */}
										<Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
											{(() => {
												const selected = (localResearch?.comparables ?? []).filter((c) => c.selected);
												if (selected.length === 0) return null;
												const avgPrice = selected.reduce((s, c) => s + c.salePrice, 0) / selected.length;
												const avgAdj = selected.reduce((s, c) => s + c.adjustedValue, 0) / selected.length;
												const avgPsf = selected.reduce((s, c) => s + (c.squareFootage ? c.salePrice / c.squareFootage : 0), 0) / selected.length;
												return (
													<>
														<Alert severity="info" icon={false} sx={{ flex: 1 }}>
															<Typography variant="body2"><strong>Selected:</strong> {selected.length} comps</Typography>
														</Alert>
														<Alert severity="info" icon={false} sx={{ flex: 1 }}>
															<Typography variant="body2"><strong>Avg Sale Price:</strong> ${avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Typography>
														</Alert>
														<Alert severity="info" icon={false} sx={{ flex: 1 }}>
															<Typography variant="body2"><strong>Avg Adjusted Value:</strong> ${avgAdj.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Typography>
														</Alert>
														<Alert severity="info" icon={false} sx={{ flex: 1 }}>
															<Typography variant="body2"><strong>Avg $/Sq Ft:</strong> ${avgPsf.toFixed(2)}</Typography>
														</Alert>
													</>
												);
											})()}
										</Box>
									</>
								) : (
									<Alert severity="info" sx={{ mt: 1 }}>
										No comparable properties have been added to the research yet.
										{isResearchEditable && ' Click "Add Comparable" to begin.'}
									</Alert>
								)}

								{/* Additional Research & Internal Notes */}
								{isResearchEditable ? (
									<Grid container spacing={2} sx={{ mt: 2 }}>
										<Grid item xs={12} md={6}>
											<TextField
												label="Additional Research"
												fullWidth
												multiline
												rows={4}
												value={localResearch?.additionalResearch ?? ''}
												onChange={(e) => handleResearchFieldChange('additionalResearch', e.target.value)}
												placeholder="Market analysis notes, data sources, methodology..."
											/>
										</Grid>
										<Grid item xs={12} md={6}>
											<TextField
												label="Internal Notes"
												fullWidth
												multiline
												rows={4}
												value={localResearch?.internalNotes ?? ''}
												onChange={(e) => handleResearchFieldChange('internalNotes', e.target.value)}
												placeholder="Internal team notes (not shared externally)..."
											/>
										</Grid>
									</Grid>
								) : (
									<Grid container spacing={2} sx={{ mt: 2 }}>
										{localResearch?.additionalResearch && (
											<Grid item xs={12} md={6}>
												<Typography variant="subtitle2" color="textSecondary" gutterBottom>Additional Research</Typography>
												<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{localResearch.additionalResearch}</Typography>
											</Grid>
										)}
										{localResearch?.internalNotes && (
											<Grid item xs={12} md={6}>
												<Typography variant="subtitle2" color="textSecondary" gutterBottom>Internal Notes</Typography>
												<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{localResearch.internalNotes}</Typography>
											</Grid>
										)}
									</Grid>
								)}
							</CardContent>
						)}
					{/* Tab 4: Communications */}
					{tabValue === 4 && (
						<CardContent>
							<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
								<Tooltip title="Send Email">
									<span>
										<IconButton
											size="small"
											disabled={!rovDetail.requestorEmail}
											onClick={() => { setMsgChannel('email'); setMsgOpen(true); }}
										>
											<EmailIcon />
										</IconButton>
									</span>
								</Tooltip>
								<Tooltip title="Send SMS">
									<span>
										<IconButton
											size="small"
											disabled={!rovDetail.requestorPhone}
											onClick={() => { setMsgChannel('sms'); setMsgOpen(true); }}
										>
											<SmsIcon />
										</IconButton>
									</span>
								</Tooltip>
							</Box>
							<CommunicationHistory entityType="rov" entityId={id ?? ''} />
						</CardContent>
					)}
						{/* Tab 3: Timeline */}
						{tabValue === 3 && (
							<CardContent>
								<Timeline>
									{rovDetail.timeline.map((event, index) => (
										<TimelineItem key={event.id ?? index}>
											<TimelineSeparator>
												<TimelineDot color="primary" />
												{index < rovDetail.timeline.length - 1 && <TimelineConnector />}
											</TimelineSeparator>
											<TimelineContent>
												<Typography variant="subtitle2" fontWeight={600}>
													{event.action}
												</Typography>
												<Typography variant="body2" color="textSecondary">
													{event.performedBy} • {new Date(event.timestamp).toLocaleString()}
												</Typography>
												{event.details && (
													<Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
														{event.details}
													</Typography>
												)}
											</TimelineContent>
										</TimelineItem>
									))}
								</Timeline>
							</CardContent>
						)}
					</Card>
				</Grid>
			</Grid>

			{/* Response Dialog */}
			<Dialog 
				open={responseDialogOpen} 
				onClose={() => setResponseDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>
					{responseType === 'approve' ? 'Approve ROV Request' : 'Reject ROV Request'}
				</DialogTitle>
				<DialogContent>
					{responseType === 'approve' && (
						<TextField
							label="Approved Value"
							type="number"
							fullWidth
							value={approvedValue}
							onChange={(e) => setApprovedValue(e.target.value)}
							sx={{ mb: 2, mt: 1 }}
							InputProps={{
								startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
							}}
						/>
					)}
					<TextField
						label={responseType === 'approve' ? 'Approval Notes' : 'Rejection Reasoning'}
						multiline
						rows={4}
						fullWidth
						value={responseNotes}
						onChange={(e) => setResponseNotes(e.target.value)}
						placeholder={
							responseType === 'approve' 
								? 'Explain why you are approving this request and any conditions...'
								: 'Explain why this request is being rejected...'
						}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setResponseDialogOpen(false)}>
						Cancel
					</Button>
					<Button 
						onClick={handleSubmitResponse}
						variant="contained"
						color={responseType === 'approve' ? 'success' : 'error'}
						startIcon={<SendIcon />}
					>
						Submit {responseType === 'approve' ? 'Approval' : 'Rejection'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Add Comparable Dialog */}
			<Dialog
				open={addCompDialogOpen}
				onClose={() => setAddCompDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Add Comparable Property</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ mt: 0.5 }}>
						<Grid item xs={12}>
							<TextField label="Street Address" fullWidth value={newComp.address}
								onChange={(e) => setNewComp((p) => ({ ...p, address: e.target.value }))} />
						</Grid>
						<Grid item xs={5}>
							<TextField label="City" fullWidth value={newComp.city}
								onChange={(e) => setNewComp((p) => ({ ...p, city: e.target.value }))} />
						</Grid>
						<Grid item xs={3}>
							<TextField label="State" fullWidth value={newComp.state}
								onChange={(e) => setNewComp((p) => ({ ...p, state: e.target.value }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="ZIP Code" fullWidth value={newComp.zipCode}
								onChange={(e) => setNewComp((p) => ({ ...p, zipCode: e.target.value }))} />
						</Grid>
						<Grid item xs={6}>
							<TextField label="Sale Price ($)" fullWidth type="number" value={newComp.salePrice}
								onChange={(e) => setNewComp((p) => ({ ...p, salePrice: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={6}>
							<TextField label="Square Footage" fullWidth type="number" value={newComp.squareFootage}
								onChange={(e) => setNewComp((p) => ({ ...p, squareFootage: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Bedrooms" fullWidth type="number" value={newComp.bedrooms}
								onChange={(e) => setNewComp((p) => ({ ...p, bedrooms: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Bathrooms" fullWidth type="number" value={newComp.bathrooms}
								onChange={(e) => setNewComp((p) => ({ ...p, bathrooms: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Year Built" fullWidth type="number" value={newComp.yearBuilt}
								onChange={(e) => setNewComp((p) => ({ ...p, yearBuilt: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Distance (mi)" fullWidth type="number" value={newComp.distanceFromSubject}
								onChange={(e) => setNewComp((p) => ({ ...p, distanceFromSubject: Number(e.target.value) }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Condition" fullWidth value={newComp.condition}
								onChange={(e) => setNewComp((p) => ({ ...p, condition: e.target.value }))} />
						</Grid>
						<Grid item xs={4}>
							<TextField label="Source" fullWidth value={newComp.source} placeholder="MLS, Public Records"
								onChange={(e) => setNewComp((p) => ({ ...p, source: e.target.value }))} />
						</Grid>
						<Grid item xs={6}>
							<TextField label="Adj. Total ($)" fullWidth type="number" value={newComp.adjustments?.total ?? 0}
								onChange={(e) => setNewComp((p) => ({ ...p, adjustments: { total: Number(e.target.value) } }))} />
						</Grid>
						<Grid item xs={6}>
							<TextField label="Adjusted Value ($)" fullWidth type="number" value={newComp.adjustedValue}
								onChange={(e) => setNewComp((p) => ({ ...p, adjustedValue: Number(e.target.value) }))} />
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setAddCompDialogOpen(false)}>Cancel</Button>
					<Button
						onClick={handleAddComp}
						variant="contained"
						disabled={!newComp.address}
						startIcon={<AddIcon />}
					>
						Add
					</Button>
				</DialogActions>
			</Dialog>

			{/* Send Message Dialog */}
			<SendMessageDialog
				open={msgOpen}
				onClose={() => setMsgOpen(false)}
				recipientEmail={rovDetail.requestorEmail}
				recipientPhone={rovDetail.requestorPhone}
				recipientName={rovDetail.requestorName}
				defaultChannel={msgChannel}
			/>

			{/* Snackbar for save feedback */}
			<Snackbar
				open={!!snackMessage}
				autoHideDuration={3000}
				onClose={() => setSnackMessage('')}
				message={snackMessage}
			/>
		</Box>
		</CollaborationProvider>
	);
}
