import React from 'react';
import {
  Table,
  Panel,
  Badge,
  Popover,
  OverlayTrigger,
  Label
} from 'react-bootstrap';
import moment from 'moment';
import { func, string, bool, object } from 'prop-types';
import { Link } from 'react-router-dom';
import { sentenceCase } from 'change-case';
import { find, propEq } from 'ramda';
import Icon from 'react-fontawesome';
import DateView from '../../components/DateView';
import Spinner from '../../components/Spinner';
import Markdown from '../../components/Markdown';
import Error from '../../components/Error';
import styles from './styles.css';

const stabilityColors = {
  experimental: 'default',
  stable: 'success',
  deprecated: 'danger'
};

export default class WorkerTypeTable extends React.PureComponent {
  static propTypes = {
    queue: object,
    awsProvisioner: object,
    setOrderableProperties: func,
    provisionerId: string,
    orderBy: string,
    searchTerm: string,
    lastActive: bool
  };

  constructor(props) {
    super(props);

    this.state = {
      workerTypes: [],
      workerTypeSummaries: [],
      loading: false,
      error: null
    };
  }

  readWorkerTypes(props) {
    this.setState({ workerTypes: [], loading: true, error: null });
    this.loadWorkerTypes(props);
  }

  componentWillMount() {
    if (this.props.provisionerId) {
      this.readWorkerTypes(this.props);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.provisionerId &&
      this.props.provisionerId !== nextProps.provisionerId
    ) {
      this.readWorkerTypes(nextProps);
    }
  }

  async loadWorkerTypes({ provisionerId }, token) {
    try {
      const {
        workerTypes,
        continuationToken
      } = await this.props.queue.listWorkerTypes(
        provisionerId,
        token ? { continuationToken: token, limit: 100 } : { limit: 100 }
      );

      this.setState({
        workerTypes: this.state.workerTypes
          ? this.state.workerTypes.concat(workerTypes)
          : workerTypes
      });

      if (continuationToken) {
        this.loadWorkerTypes(this.props, continuationToken);
      }

      const awsWorkerTypes =
        provisionerId === 'aws-provisioner-v1' &&
        (await this.props.awsProvisioner.listWorkerTypeSummaries());

      const workerTypesNormalized = this.state.workerTypes.map(workerType => ({
        ...workerType,
        ...(awsWorkerTypes
          ? find(propEq('workerType', workerType.workerType))(awsWorkerTypes)
          : {})
      }));

      const workerTypeSummaries = await Promise.all(
        workerTypesNormalized.map(async workerType => {
          const pendingTasks = await this.getPendingTasks(
            provisionerId,
            workerType.workerType
          );

          const stable = {
            provisionerId: workerType.provisionerId,
            workerType: workerType.workerType,
            pendingTasks,
            stability: workerType.stability,
            lastDateActive: workerType.lastDateActive
          };

          const dynamic =
            provisionerId === 'aws-provisioner-v1'
              ? {
                  runningCapacity: workerType.runningCapacity,
                  pendingCapacity: workerType.pendingCapacity
                }
              : {};

          return { ...stable, ...dynamic };
        })
      );

      this.props.setOrderableProperties(workerTypeSummaries[0]);
      this.setState({ workerTypeSummaries, error: null, loading: false });
    } catch (err) {
      this.setState({ workerTypeSummaries: [], error: err, loading: false });
    }
  }

  async getPendingTasks(provisionerId, workerType) {
    const { pendingTasks } = await this.props.queue.pendingTasks(
      provisionerId,
      workerType
    );

    return pendingTasks;
  }

  renderDescription = ({ description }) => (
    <Popover id="popover-trigger-click-root-close" title="Description">
      <Markdown>{description || '`-`'}</Markdown>
    </Popover>
  );

  renderGridWorkerType = (workerType, key) => {
    const description = this.renderDescription(workerType);
    const Header = () => (
      <div>
        <OverlayTrigger
          trigger="click"
          rootClose
          placement="right"
          overlay={description}>
          <div className="pull-right">
            <Icon role="button" name="info" />
          </div>
        </OverlayTrigger>
        <span>
          <Link
            to={`/workers/provisioners/${workerType.provisionerId}/worker-types/${workerType.workerType}`}>
            {workerType.workerType}
          </Link>
        </span>
      </div>
    );

    return (
      <Panel
        key={`worker-type-grid-${key}`}
        className={styles.card}
        header={<Header key={`worker-type-header-${key}`} />}
        bsStyle={`${stabilityColors[workerType.stability]}`}>
        <Table fill>
          <tbody>
            {this.props.provisionerId === 'aws-provisioner-v1' &&
              ['runningCapacity', 'pendingCapacity'].map((property, key) => (
                <tr key={`dynamic-data-${key}`}>
                  <td>{sentenceCase(property)}</td>
                  <td>
                    <Badge>{workerType[property]}</Badge>
                  </td>
                </tr>
              ))}
            <tr>
              <td>Pending tasks</td>
              <td>
                <Badge>{workerType.pendingTasks}</Badge>
              </td>
            </tr>
            <tr>
              <td>Stability</td>
              <td>{workerType.stability}</td>
            </tr>
            <tr>
              <td>Last active</td>
              <td>
                <DateView date={workerType.lastDateActive} />
              </td>
            </tr>
          </tbody>
        </Table>
      </Panel>
    );
  };

  renderTabularWorkerType = workerTypes => (
    <div className={styles.tabular}>
      <Table responsive>
        <thead>
          <tr>
            <th>Worker-type</th>
            <th>Stability</th>
            <th>Last active</th>
            <th>Pending tasks</th>
            {this.props.provisionerId === 'aws-provisioner-v1' &&
              ['runningCapacity', 'pendingCapacity'].map((property, key) => (
                <th key={`tabular-dynamic-header-${key}`}>
                  {sentenceCase(property)}
                </th>
              ))}
          </tr>
        </thead>

        <tbody>
          {workerTypes.map((workerType, key) => (
            <tr key={`worker-type-tabular-${key}`}>
              <td>
                <Link
                  to={`/workers/provisioners/${workerType.provisionerId}/worker-types/${workerType.workerType}`}>
                  {workerType.workerType}
                </Link>
                &nbsp;&nbsp;&nbsp;
                <OverlayTrigger
                  trigger="click"
                  rootClose
                  placement="right"
                  overlay={this.renderDescription(workerType)}>
                  <Icon role="button" name="info" />
                </OverlayTrigger>
              </td>
              <td>
                <Label
                  bsStyle={stabilityColors[workerType.stability]}
                  style={{ borderRadius: 0, marginLeft: 10, marginBottom: 5 }}>
                  {workerType.stability}
                </Label>
              </td>
              <td>
                <DateView date={workerType.lastDateActive} />
              </td>
              <td>
                <Badge>{workerType.pendingTasks}</Badge>
              </td>
              {this.props.provisionerId === 'aws-provisioner-v1' &&
                ['runningCapacity', 'pendingCapacity'].map((property, key) => (
                  <td key={`tabular-dynamic-row-${key}`}>
                    <Badge>{workerType[property]}</Badge>
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  renderWorkerType = workerTypes =>
    this.props.layout === 'grid'
      ? workerTypes.map(this.renderGridWorkerType)
      : this.renderTabularWorkerType(workerTypes);

  sort = (a, b) => {
    if (this.props.lastActive) {
      return moment(a.lastDateActive).diff(moment(b.lastDateActive)) < 0
        ? 1
        : -1;
    }

    if (this.props.orderBy) {
      const diff = a[this.props.orderBy] - b[this.props.orderBy];

      if (diff === 0) {
        return 0;
      }

      return diff < 0 ? 1 : -1;
    }

    return a.workerType.localeCompare(b.workerType);
  };

  render() {
    if (this.state.error) {
      return <Error error={this.state.error} />;
    }

    if (this.state.loading) {
      return <Spinner />;
    }

    if (!this.state.workerTypeSummaries.length) {
      return <div>No worker types to display.</div>;
    }

    return (
      <div className={styles.container}>
        {this.renderWorkerType(
          this.state.workerTypeSummaries
            .filter(workerType =>
              workerType.workerType.includes(this.props.searchTerm)
            )
            .sort(this.sort)
        )}
      </div>
    );
  }
}
